import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, relative_path: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


queries = load_module("queries_under_test", "sdk/src/sdk/queries.py")


class QueryTests(unittest.IsolatedAsyncioTestCase):
    def test_build_step_records_marks_ambiguous_null_step_tools(self):
        steps = [
            {"function_id": 1, "function_name": "lookup", "error": None},
            {"function_id": 2, "function_name": "lookup", "error": None},
        ]
        events = [
            {
                "span_id": "span-1",
                "step_id": None,
                "event_type": "tool_call",
                "tool_name": "lookup",
                "tool_args": {"q": "a"},
            },
            {
                "span_id": "span-2",
                "step_id": None,
                "event_type": "tool_call",
                "tool_name": "lookup",
                "tool_args": {"q": "b"},
            },
        ]

        records = queries.build_step_records(steps, events)

        self.assertEqual(records[0]["tool_name"], "lookup")
        self.assertIsNone(records[0]["tool_args"])
        self.assertEqual(records[0]["tool_match_status"], "ambiguous")
        self.assertEqual(records[1]["tool_match_status"], "ambiguous")

    def test_build_step_records_attaches_single_unambiguous_null_step_tool(self):
        steps = [{"function_id": 1, "function_name": "lookup", "error": None}]
        events = [
            {
                "span_id": "span-1",
                "step_id": None,
                "event_type": "tool_call",
                "tool_name": "lookup",
                "tool_args": {"q": "a"},
            }
        ]

        records = queries.build_step_records(steps, events)

        self.assertEqual(records[0]["tool_args"], {"q": "a"})
        self.assertIsNone(records[0]["tool_match_status"])

    def test_build_step_records_tolerates_missing_dbos_keys(self):
        records = queries.build_step_records([{"error": None}], [])

        self.assertEqual(records[0]["status"], "SUCCESS")
        self.assertIsNone(records[0]["step_id"])
        self.assertIsNone(records[0]["function_name"])

    async def test_fetch_agent_events_for_dashboard_swallows_read_failures(self):
        with (
            mock.patch.object(queries, "fetch_agent_events_async", side_effect=RuntimeError("boom")),
            self.assertLogs(queries.logger, level="ERROR"),
        ):
            events = await queries.fetch_agent_events_for_dashboard("wf", "postgresql://db")

        self.assertEqual(events, [])


def install_tracing_stubs():
    agents = types.ModuleType("agents")
    tracing_pkg = types.ModuleType("agents.tracing")
    processor_interface = types.ModuleType("agents.tracing.processor_interface")
    span_data = types.ModuleType("agents.tracing.span_data")
    dbos = types.ModuleType("dbos")

    class TracingProcessor:
        pass

    class FunctionSpanData:
        def __init__(self, name=None, input=None, output=None):
            self.name = name
            self.input = input
            self.output = output

    class GenerationSpanData:
        pass

    class HandoffSpanData:
        pass

    class ResponseSpanData:
        pass

    class DBOS:
        workflow_id = "workflow-1"
        step_id = 7

    processor_interface.TracingProcessor = TracingProcessor
    span_data.FunctionSpanData = FunctionSpanData
    span_data.GenerationSpanData = GenerationSpanData
    span_data.HandoffSpanData = HandoffSpanData
    span_data.ResponseSpanData = ResponseSpanData
    dbos.DBOS = DBOS
    tracing_pkg.add_trace_processor = mock.Mock()

    sys.modules["agents"] = agents
    sys.modules["agents.tracing"] = tracing_pkg
    sys.modules["agents.tracing.processor_interface"] = processor_interface
    sys.modules["agents.tracing.span_data"] = span_data
    sys.modules["dbos"] = dbos

    return FunctionSpanData, DBOS, tracing_pkg.add_trace_processor


def install_decorator_stubs():
    dbos = types.ModuleType("dbos")
    dbos_openai_agents = types.ModuleType("dbos_openai_agents")

    class DBOS:
        logger = mock.Mock()

        def __init__(self, config=None):
            self.config = config

        @staticmethod
        def workflow(name=None, max_recovery_attempts=None):
            def decorator(fn):
                fn._dbos_workflow_name = name
                fn._dbos_max_recovery_attempts = max_recovery_attempts
                return fn

            return decorator

        @staticmethod
        def step(**_kwargs):
            def decorator(fn):
                return fn

            return decorator

    class DBOSRunner:
        pass

    dbos.DBOS = DBOS
    dbos.DBOSConfig = dict
    dbos_openai_agents.DBOSRunner = DBOSRunner

    sys.modules["dbos"] = dbos
    sys.modules["dbos_openai_agents"] = dbos_openai_agents


class AgentRegistryTests(unittest.TestCase):
    def setUp(self):
        install_decorator_stubs()
        self.decorators = load_module("decorators_registry_under_test", "sdk/src/sdk/decorators.py")

    def test_agent_decorator_registers_named_workflow(self):
        async def run_topic(topic: str) -> str:
            return topic

        workflow_fn = self.decorators.agent(name="research-assistant")(run_topic)

        registered = self.decorators.get_registered_agent("research-assistant")
        self.assertEqual(registered.name, "research-assistant")
        self.assertIs(registered.workflow, workflow_fn)
        self.assertEqual(workflow_fn._dbos_workflow_name, "research-assistant")

    def test_agent_decorator_rejects_duplicate_names(self):
        self.decorators.agent(name="research-assistant")(lambda value: value)

        with self.assertRaisesRegex(ValueError, "already registered"):
            self.decorators.agent(name="research-assistant")(lambda value: value)

    def test_get_registered_agent_reports_available_names(self):
        self.decorators.agent(name="research-assistant")(lambda value: value)

        with self.assertRaisesRegex(ValueError, "research-assistant"):
            self.decorators.get_registered_agent("missing-agent")

    def test_list_registered_agents_is_sorted_by_name(self):
        self.decorators.agent(name="zeta")(lambda value: value)
        self.decorators.agent(name="alpha")(lambda value: value)

        self.assertEqual(
            [agent.name for agent in self.decorators.list_registered_agents()],
            ["alpha", "zeta"],
        )


class TracingTests(unittest.TestCase):
    def setUp(self):
        self.FunctionSpanData, self.DBOS, self.add_trace_processor = install_tracing_stubs()
        self.tracing = load_module("tracing_under_test", "sdk/src/sdk/tracing.py")

    def test_tool_outputs_preserve_falsy_values(self):
        processor = self.tracing.CheckpointTracingProcessor("postgresql://db")

        for value, expected in [(0, "0"), (False, "False"), ([], "[]"), (None, None), ("ok", "ok")]:
            with self.subTest(value=value):
                span = types.SimpleNamespace(
                    span_id=f"span-{value!r}",
                    span_data=self.FunctionSpanData(name="tool", input="{}", output=value),
                )
                with mock.patch.object(self.tracing, "_write_agent_event") as write:
                    processor.on_span_end(span)

                record = write.call_args.args[1]
                self.assertEqual(record["tool_result"], expected)

    def test_event_key_distinguishes_retry_step_identity(self):
        span = types.SimpleNamespace(span_id="span-1", trace_id="trace-1")
        base = {
            "workflow_id": "workflow-1",
            "span_id": "span-1",
            "event_type": "tool_call",
            "tool_name": "lookup",
        }

        first = self.tracing._event_key({**base, "step_id": 1}, span)
        retry = self.tracing._event_key({**base, "step_id": 2}, span)
        duplicate = self.tracing._event_key({**base, "step_id": 1}, span)

        self.assertNotEqual(first, retry)
        self.assertEqual(first, duplicate)

    def test_span_start_step_id_is_used_when_end_context_is_missing(self):
        processor = self.tracing.CheckpointTracingProcessor("postgresql://db")
        span = types.SimpleNamespace(
            span_id="span-1",
            span_data=self.FunctionSpanData(name="tool", input="{}", output="ok"),
        )

        self.DBOS.step_id = 11
        processor.on_span_start(span)
        self.DBOS.step_id = None
        with mock.patch.object(self.tracing, "_write_agent_event") as write:
            processor.on_span_end(span)

        record = write.call_args.args[1]
        self.assertEqual(record["step_id"], 11)

    def test_connect_kwargs_include_short_timeouts(self):
        kwargs = self.tracing._connect_kwargs()

        self.assertEqual(kwargs["connect_timeout"], 3)
        self.assertIn("statement_timeout=3000", kwargs["options"])
        self.assertIn("lock_timeout=1000", kwargs["options"])

    def test_connection_pool_is_reused_and_bounded(self):
        fake_pool = object()
        with mock.patch.object(
            self.tracing.psycopg2.pool,
            "ThreadedConnectionPool",
            return_value=fake_pool,
        ) as pool_cls:
            first = self.tracing._get_pool("postgresql://db")
            second = self.tracing._get_pool("postgresql://db")

        self.assertIs(first, fake_pool)
        self.assertIs(second, fake_pool)
        pool_cls.assert_called_once()
        self.assertEqual(pool_cls.call_args.args[:3], (1, 4, "postgresql://db"))

    def test_register_checkpoint_processor_is_idempotent(self):
        with mock.patch.object(self.tracing, "ensure_tables") as ensure_tables:
            self.tracing.register_checkpoint_tracing_processor("postgresql://db")
            self.tracing.register_checkpoint_tracing_processor("postgresql://db")

        ensure_tables.assert_called_once_with("postgresql://db")
        self.add_trace_processor.assert_called_once()


if __name__ == "__main__":
    unittest.main()
