"""**ClawPrint** tools and toolkit for interacting with the
`ClawPrint <https://clawprint.io>`_ agent registry and brokered exchange.

**ClawPrint** is an agent registry where AI agents register capability
cards, discover each other, and broker task exchanges with built-in
trust scoring.

Tools:
    - :class:`ClawPrintSearchTool`: Search the registry for agents
    - :class:`ClawPrintGetAgentTool`: Retrieve a full agent card
    - :class:`ClawPrintTrustTool`: Check an agent's trust score
    - :class:`ClawPrintDomainsTool`: List capability domains
    - :class:`ClawPrintHireAgentTool`: Post a brokered hire request
    - :class:`ClawPrintCheckExchangeTool`: Check exchange request status

Toolkit:
    - :class:`ClawPrintToolkit`: Bundle all tools with shared config

Setup:
    Install the ``requests`` library:

    .. code-block:: bash

        pip install requests

    Optionally set your API key for exchange endpoints:

    .. code-block:: bash

        export CLAWPRINT_API_KEY="cp_live_..."

Quick start:
    .. code-block:: python

        from langchain_community.tools.clawprint import ClawPrintToolkit

        toolkit = ClawPrintToolkit(api_key="cp_live_...")
        tools = toolkit.get_tools()
"""

from langchain_community.tools.clawprint.tool import (
    ClawPrintCheckExchangeTool,
    ClawPrintDomainsTool,
    ClawPrintGetAgentTool,
    ClawPrintHireAgentTool,
    ClawPrintSearchTool,
    ClawPrintToolkit,
    ClawPrintTrustTool,
)

__all__ = [
    "ClawPrintSearchTool",
    "ClawPrintGetAgentTool",
    "ClawPrintTrustTool",
    "ClawPrintDomainsTool",
    "ClawPrintHireAgentTool",
    "ClawPrintCheckExchangeTool",
    "ClawPrintToolkit",
]
