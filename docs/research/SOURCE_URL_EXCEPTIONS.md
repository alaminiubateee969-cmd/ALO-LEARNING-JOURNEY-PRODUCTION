# Source URL exceptions — 2026-10-18

- The historical initial prompt contains a malformed concatenation: `httpshttps://github.com/elebumm/RedditVideoMakerBot.git://github.com/OpenTalker/video-retalking.git`. It appears to concatenate two real repositories. Both were independently listed elsewhere and catalogued separately; no guessed third repository was created.
- `https://github.com/Onyx-Dev-Labs` is an organization/owner URL, not a complete repository URL. GitHub REST returned 404 for it; ask which repository was intended.
- `engralaminn-collab/alo-education-uk-final`, `engralaminn-collab/ukvi-ai-markting_n8n`, and `engralaminn-collab/Ai-Markting-crm` returned HTTP 404 to the GitHub API without repository visibility. They may be private, moved, or misspelled; do not infer source contents.
- 135 unique repository URLs were produced after case-insensitive duplicate normalization across the user’s submitted repository lists, including the earlier video/AI references.
