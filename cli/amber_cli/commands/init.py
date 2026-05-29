"""amber init — scaffold a new Amber agent project."""

import os

import click

from amber_cli.config_loader import find_config_path


@click.command()
@click.option("--name", help="Project name (default: directory name)")
@click.option("--directory", default=".", help="Directory to initialize")
def init(name: str, directory: str) -> None:
    """Initialize a new Amber agent project."""
    target = os.path.abspath(directory)
    config_path = os.path.join(target, "amber.yaml")

    if find_config_path(target):
        click.echo(f"Already initialized: {config_path}")
        return

    if not name:
        name = os.path.basename(target)

    config_content = f"""# Amber Runtime configuration
# https://github.com/amber-runtime/playground

name: {name}

# Agents are auto-detected from @agent decorators in your code.
# Override here if needed:
# agents:
#   - my-agent

# Optional: infrastructure settings (sensible defaults applied)
# region: us-east-1
# environment: dev
# dashboard: true
"""

    os.makedirs(target, exist_ok=True)
    with open(config_path, "w") as f:
        f.write(config_content)

    click.echo(f"Created {config_path}")
    click.echo()
    click.echo("Next steps:")
    click.echo(f"  1. Set your API key:  amber config set openai-api-key")
    click.echo(f"  2. Deploy:            amber deploy")
