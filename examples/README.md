# Examples

Real, complete agent outputs, not staged transcripts. Each `.md` file below
walks through one question end to end: the actual MCP tool calls made, the
actual GROQ query the model wrote, and the actual answer. The matching
`*-raw.txt` file is the unedited stdout/stderr of running that exact command.

- [bori-demo.md](bori-demo.md): the page-7 table swap
- [choba-demo.md](choba-demo.md): the A-type curve mislabel
- [eval-summary.md](eval-summary.md): pointer to the full Phase 4 eval (9
  questions x 3 reps x 2 conditions) and its scorecard

Reproduce any of these yourself:

```bash
node agent/index.js "I got a 2950 ohm-m reading at BMGS Bori Field. Is that normal or anomalous, and can I trust it?"
node agent/index.js "Is the Choba Lawn Tennis Field curve really an A-type curve like the paper says?"
node agent/index.js --offline "I got a 2950 ohm-m reading at BMGS Bori Field. Is that normal or anomalous, and can I trust it?"
```
