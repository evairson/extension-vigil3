
from uagents import Agent, Context, Model
import os
from pathlib import Path

BASE_DIR = Path(__file__).parent / "agent_data"
BASE_DIR.mkdir(exist_ok=True) 
os.environ["AGENT_DATA_DIR"] = str(BASE_DIR)


class AuditReport(Model):
    slither: str
    solidity: str
    user : str
    question : str

class Analysis(Model):
    vulnerability: dict
    reasoning: str

class ReasonedAnalysis(Model):
    analysis: list[Analysis]
    user : str

client = Agent(name="vscode_client", port=8031,
    mailbox=True,)

@client.on_rest_post("/send_audit", AuditReport, ReasonedAnalysis)
async def send_audit(ctx: Context, request: AuditReport) -> ReasonedAnalysis:
    solidity = request.solidity
    slither = request.slither
    user = client.address
    ctx.logger.info("📨 Sending audit request to Vigil3Audit agent...")

    reply, status = await ctx.send_and_receive(
        "agent1qtz4tzy6n783m4ap79neh4war4jmyjny0rqvx4w3pdnve6scyexpcp94yuq",  # adresse de ton agent sur Agentverse
        AuditReport(solidity=solidity, slither=slither, user=user, question=""),
        response_type=ReasonedAnalysis,
        timeout=300,
    )

    print("📩 Received analysis from Vigil3Audit agent.")
    return reply

if __name__ == "__main__":
    client.run()