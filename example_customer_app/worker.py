"""
Queue worker for the customer app demo.

Run:
  uv run python -m example_customer_app.worker
"""

from dotenv import load_dotenv

from sdk import Runtime, WorkerService

load_dotenv()


def main() -> None:
    runtime = Runtime()
    worker = WorkerService(
        runtime=runtime,
        agent_modules=[
            "example_customer_app.user_agents.single_agent_demo",
            "example_customer_app.user_agents.multi_agent_demo",
            "example_customer_app.user_agents.queued_multi_agent_demo",
        ],
        queue_name="agent-runs",
        worker_concurrency=1,
    )
    worker.run()


if __name__ == "__main__":
    main()
