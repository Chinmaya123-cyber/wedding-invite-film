# Connecting the Atlabs MCP

Every painting in the film — the street wall, the window, the banner cloth, the elder on the roof, the rider, the props, each
ceremony painting, and the couple's painted portrait — is generated with Atlabs. The skill stops and asks you to connect it
if it isn't available.

1. **Account** — sign up at https://app.atlabs.ai. Generations use credits:
   - a new place ≈ 13–15 paintings ≈ 13–15 credits (Nano Banana 2.1, ~1 credit each)
   - the couple's portrait or the couple on the scooter: +1 each
   - an original instrumental (if you have no song): one music generation
   - **Rajasthan** and **Santorini** ship with finished paintings: 0 credits for a text-only invite
2. **Connect**
   - **Claude Code, plugin installed:** `/mcp` → choose **atlabs** → sign in.
   - **Claude Code, manual:** `claude mcp add --transport http atlabs https://mcp.atlabs.ai/mcp` → `/mcp` → **atlabs** → sign in.
   - **Claude Desktop / claude.ai:** Settings → Connectors → **Add custom connector** → Name `Atlabs`, URL
     `https://mcp.atlabs.ai/mcp` → **Add** → **Connect** → sign in. Enable it for the chat from the tools menu.
3. **Check** — ask Claude "check my Atlabs credits". If it shows a balance, you're ready.

## What the skill does with it
| step | Atlabs tool |
|---|---|
| check connection and credits, quote the cost | `get_account` |
| upload style anchors, the couple's photos, a venue photo | `start_upload` (+ HTTP PUT) or `upload_from_browser` |
| paint every missing piece, in parallel | `generate_image` — **Nano Banana 2.1** (scenes, props, portraits), **GPT Image 2.5 Sunburst** (repainting a real venue photo) |
| night / sunset versions of a painting (same composition) | `generate_image` with the day painting as the only reference |
| collect results | `get_result` |
| optional original music | `generate_music` |

Prompts are written by the skill (`scripts/art_jobs.mjs`) from the place's theme, so every place comes out in the same
hand-painted gouache style. Full detail: [skills/wedding-invite-film/references/atlabs-mcp.md](../skills/wedding-invite-film/references/atlabs-mcp.md).
