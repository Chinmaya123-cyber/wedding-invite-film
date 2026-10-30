# Installation

## 1. Get the skill

**As a Claude Code plugin** (adds the Atlabs MCP for you):
```
/plugin marketplace add Chinmaya123-cyber/wedding-invite-film
/plugin install wedding-invite-film@wedding-invite-film
```

**As a plain skill:**
```bash
git clone https://github.com/Chinmaya123-cyber/wedding-invite-film
cp -R wedding-invite-film/skills/wedding-invite-film ~/.claude/skills/
```
Claude Desktop / claude.ai: download `wedding-invite-film.skill` from the
[latest release](https://github.com/Chinmaya123-cyber/wedding-invite-film/releases/latest) and add it under
Settings → Capabilities → Skills.

## 2. Connect the Atlabs MCP (required)
See [atlabs-mcp.md](atlabs-mcp.md). All paintings are generated there.

## 3. Local tools (for rendering)
- **Node 18+** and **ffmpeg** (`brew install node ffmpeg` on macOS)
- **Playwright** with Chromium:
  ```bash
  cd ~/.claude/skills/wedding-invite-film && npm install && npx playwright install chromium
  ```
- **Python 3.10+** with numpy, scipy, pillow and rembg (background removal for the cut-outs):
  ```bash
  python3 -m pip install -r ~/.claude/skills/wedding-invite-film/requirements.txt
  ```
  To use a specific Python, set `WIF_PY=/path/to/python`.

## 4. Check
Ask Claude: *"Make a Rajasthan wedding invite video for Asha and Kabir, using song.mp3"* — the Rajasthan and Santorini
themes ship with finished paintings, so this first run needs no Atlabs credits for art.

Disk: rendering writes JPEG frames to the temp folder — keep ~3 GB free for a 90-second 1080p film.
