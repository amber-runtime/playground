"""
Checkpoint runtime.

Loads configured customer agent modules, initializes DBOS, and executes
SDK-registered agents by name.

## Local configuration
Add registered-agent modules to `.env`:

  CHECKPOINT_AGENT_MODULES=user_agents.single_agent_demo,user_agents.multi_agent_demo
  CHECKPOINT_RUNTIME_NAME=local-checkpoint-runtime

## Run
  uv run uvicorn runtime.runtime:app --port 8002
"""

import importlib
import os
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any, Optional

from dbos import DBOS
from dbos._error import DBOSNonExistentWorkflowError
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from sdk import (
    build_step_records,
    fetch_agent_events_for_dashboard,
    get_registered_agent,
    get_steps,
    get_workflow,
    init,
    list_registered_agents,
    list_workflows,
)

load_dotenv()


def _split_csv(value: str | None) -> tuple[str, ...]:
    if not value:
        return ()
    return tuple(item.strip() for item in value.split(",") if item.strip())


@dataclass(frozen=True)
class RuntimeConfig:
    name: str
    db_url: str
    agent_modules: tuple[str, ...]

    @classmethod
    def from_env(cls) -> "RuntimeConfig":
        return cls(
            name=os.environ.get("CHECKPOINT_RUNTIME_NAME", "checkpoint-runtime"),
            db_url=(
                os.environ.get("DB_URL")
                or os.environ.get("DBOS_SYSTEM_DATABASE_URL")
                or os.environ.get("CHECKPOINT_DB_URL")
                or ""
            ),
            agent_modules=_split_csv(os.environ.get("CHECKPOINT_AGENT_MODULES")),
        )


class RunRequest(BaseModel):
    agent: str = Field(description="Registered agent name to execute.")
    input: str = Field(
        description="Input string passed to the registered agent workflow."
    )


class RunResponse(BaseModel):
    workflow_id: str
    agent: str


class RegisteredAgentResponse(BaseModel):
    name: str


class HealthResponse(BaseModel):
    status: str
    runtime: str
    registered_agents: int


class WorkflowResult(BaseModel):
    workflow_id: str
    status: str
    output: Optional[str] = None


config = RuntimeConfig.from_env()


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_customer_code(config)
    registered_agents = list_registered_agents()
    if not registered_agents:
        raise RuntimeError(
            "No agents registered. Configure CHECKPOINT_AGENT_MODULES so customer "
            "code can register agents with @agent(...)."
        )

    init(name=config.name, db_url=config.db_url or None)
    yield


app = FastAPI(
    title="Checkpoint Runtime",
    description="Runtime that loads customer-defined agents from the SDK registry.",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_customer_code(runtime_config: RuntimeConfig) -> None:
    for module_name in runtime_config.agent_modules:
        load_customer_module(module_name)


def load_customer_module(module_name: str) -> None:
    importlib.import_module(module_name)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        runtime=config.name,
        registered_agents=len(list_registered_agents()),
    )


@app.get("/agents", response_model=list[RegisteredAgentResponse])
async def get_agents() -> list[RegisteredAgentResponse]:
    return [
        RegisteredAgentResponse(name=registered_agent.name)
        for registered_agent in list_registered_agents()
    ]


@app.post("/runs", response_model=RunResponse)
async def create_run(req: RunRequest) -> RunResponse:
    try:
        registered_agent = get_registered_agent(req.agent)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    handle = await DBOS.start_workflow_async(registered_agent.workflow, req.input)
    return RunResponse(workflow_id=handle.workflow_id, agent=req.agent)


@app.get("/runs/{workflow_id}", response_model=WorkflowResult)
async def get_run(workflow_id: str) -> WorkflowResult:
    try:
        handle = await DBOS.retrieve_workflow_async(workflow_id)
    except DBOSNonExistentWorkflowError:
        raise HTTPException(
            status_code=404,
            detail=f"Workflow {workflow_id!r} not found",
        ) from None

    status = (await handle.get_status()).status
    if status == "PENDING":
        return WorkflowResult(workflow_id=workflow_id, status=status)

    output = await handle.get_result()
    return WorkflowResult(
        workflow_id=workflow_id,
        status=status,
        output=str(output),
    )


@app.get("/workflows")
async def get_workflows(
    status: Optional[str] = Query(None, description="Filter: PENDING, SUCCESS, ERROR"),
    limit: int = Query(50, ge=1, le=200),
) -> list[dict[str, Any]]:
    return await list_workflows(status=status, limit=limit)


@app.get("/workflows/{workflow_id}")
async def get_workflow_detail(workflow_id: str) -> dict[str, Any]:
    workflow_record = await get_workflow(workflow_id)
    if workflow_record is None:
        raise HTTPException(
            status_code=404,
            detail=f"Workflow {workflow_id!r} not found",
        )

    steps = await get_steps(workflow_id)
    agent_events = (
        await fetch_agent_events_for_dashboard(workflow_id, config.db_url)
        if config.db_url
        else []
    )
    step_records = build_step_records(steps, agent_events)

    return {
        "workflow": workflow_record,
        "steps": step_records,
        "events": agent_events,
    }
