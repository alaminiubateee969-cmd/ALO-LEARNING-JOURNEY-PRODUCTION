#!/usr/bin/env python3
"""Read-only GitHub source inventory using GitHub's REST API.

This records repository metadata, license declaration, branch-head SHA, and
README evidence. It does not clone, install, or execute third-party code.
"""
from __future__ import annotations
import base64
import csv
import json
import re
import hashlib
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GROUPS = {
"UI, diagrams and developer tools": """
ToolJet/ToolJet
cathrynlavery/diagram-design
omacom/omarchy
cursor/plugins
AprilNEA/OpenLogi
volcengine/OpenViking
affaan-m/ECC
mksglu/context-mode
JetBrains/go-modern-guidelines
tt-a1i/archify
bilawalsidhu/gods-eye-view
BraaMohammed/bricks
fmtlib/fmt
cline/cline
vastsa/PI-Desktop
""",
"AI agents, skills, memory and model research": """
ruvnet/ruflo
FoundationAgents/MetaGPT
Gitlawb/openclaude
K-Dense-AI/scientific-agent-skills
akitaonrails/ai-memory
EfficientStreet/hindsight
sulabhdubey/rta-smriti-brain
Artistsyn/cortex_suite
timharris707/modeldeck
jingyaogong/minimind
huggingface/education-toolkit
meta-models/meta-model-cookbook
zai-org/GLM-5
thu-ml/CRM
ioi-labs/molx
THU-MAIC/OpenMAIC
tinystruct/smalltalk
nashsu/llm_wiki
""",
"Marketing, SEO, lead generation and research": """
coreyhaines31/marketingskills
every-app/open-seo
firecrawl/firecrawl
firecrawl/web-agent
guifav/market-intelligence-radar
parthasarathy123/n8n-gtm-lead-enrichment
brightdata/open-enrich
clawnify/OpenProspector
DIYgod/RSSHub
public-apis/public-apis
mohamed11sk/Email-markting
knsoftic/Email_Markting
workwithlos-ui/dave
""",
"CRM, education and business operations": """
melgarafael/DeskcommCRM
Django-CRM/Django-CRM
Odoo-mobile/crm
dennisivy/crash-course-CRM
oroinc/crm-application
oroinc/crm
trycompai/crm
frappe/crm
ChurchCRM/CRM
crmeb/CRMEB
idurar/idurar-erp-crm
fatfreecrm/fat_free_crm
twentyhq/twenty
nabaleducation/EducationConsultancyWebsite
arupdas0825/studytra
Bhawana0218/NextStep-Abroad
nwuzmedoutlook/university
""",
"Messaging, communications and productivity": """
ArnasDon/wacrm
chatwoot/chatwoot
domovinatv/sms.domovina.ai
NdoleStudio/httpsms
NdoleStudio/httpsms-node
BelledonneCommunications/linphone-iphone
0perationPrivacy/VoIP
developerspace-samples/VoIP-Call-Sample
jitsi/jitsi-videobridge
sibnerian/electron-promise-ipc
CapSoftware/Cap
nextcloud/server
siyuan-note/siyuan
dani-garcia/vaultwarden
TryGhost/Ghost
umami-software/umami
languagetool-org/languagetool
""",
"Voice, video, image and creative automation": """
debpalash/VoiceStudio
heygen-com/hyperframes
harry0703/MoneyPrinterTurbo
HM-RunningHub/ComfyUI_RH_APICall
WEIFENG2333/VideoCaptioner
ATH-MaaS/Pixelle-Video
remotion-dev/remotion
MarkTechStation/VideoCode
3b1b/videos
bradautomates/claude-video
MeiGen-AI/InfiniteTalk
zai-org/CogVideo
Tencent-Hunyuan/HunyuanVideo
Lightricks/LTX-Video
OpenTalker/video-retalking
meituan-longcat/LongCat-Video
HITsz-TMG/VideoClaw
HKUDS/VideoAgent
LoSealL/VideoSuperResolution
Augani/openreel-video
Kosinkadink/ComfyUI-VideoHelperSuite
elebumm/RedditVideoMakerBot
GAIR-NLP/LiveTalk
armory3d/armorpaint
google-research/timesfm
YaoFANGUK/video-subtitle-remover
leandromoreira/digital_video_introduction
0voice/audio_video_streaming
dunossauro/videomaker-helper
burhankocabiyik/videomaker
wtz2017/VideoMaker
viniciusenari/slideshow-videomaker
WuTao-CS/VideoMaker
shubhamdevhouse/Animated-VideoMaker
seed0001/videoMaker
Bilal-Belli/videoMakerBOT
Nncstudio/VideoMakerPro
""",
"Additional submitted repositories": """
alsk1992/CloddsBot
Lakr233/vphone-cli
blader/humanizer
YutaroHayakawa/ipftrace2
Onyx-Dev-Labs
Kayforkind/reimagine-it
templetongroup/radiant
EfficientStreet/youtube-subscriptions-ingest
ramon-victor/freegpt-webui
Lin-jun-xiang/docGPT-langchain
teremterem/claude-code-gpt-5-codex
GetGoAPI/Free-GPT-Grok-Gemini-Claude-API
anthropics/claude-plugins-community
songguoxs/gpt4o-image-prompts
""",
"Additional ALO repositories supplied": """
tech360-bd/ALO_WEB_CRM_TECH
engralaminn-collab/alo-education-uk-final
engralaminn-collab/ukvi-ai-markting_n8n
engralaminn-collab/Ai-Markting-crm
""",
}
RAW_MALFORMED = [
    "httpshttps://github.com/elebumm/RedditVideoMakerBot.git://github.com/OpenTalker/video-retalking.git",
]


def api(url: str):
    request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "ALO-AgentOS-source-audit"})
    with urllib.request.urlopen(request, timeout=25) as response:
        return json.loads(response.read())


def readme_text(repo: str) -> str:
    try:
        item = api(f"https://api.github.com/repos/{repo}/readme")
        raw = base64.b64decode(item.get("content", "")).decode("utf-8", "replace")
        return re.sub(r"\s+", " ", raw).strip()
    except Exception as error:
        return f"[README unavailable: {type(error).__name__}]"


def main():
    unique: dict[str, str] = {}
    for category, values in GROUPS.items():
        for repo in values.split():
            unique.setdefault(repo.lower(), category)
    out = ROOT / "docs/research/GITHUB_SOURCE_CATALOG.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    fields = ["url", "owner_repo", "category", "status", "default_branch", "head_sha", "last_pushed_at", "license_spdx", "license_name", "language", "stars", "size_kb", "description", "topics", "readme_evidence", "hardware_evidence", "license_file_path", "license_file_sha256", "license_file_excerpt", "license_file_status", "license_note", "disposition", "disposition_reason", "alo_equivalent", "integration_note"]
    rows = []
    for number, (repo, category) in enumerate(unique.items(), 1):
        record = {field: "" for field in fields}
        record.update({"url": f"https://github.com/{repo}", "owner_repo": repo, "category": category, "disposition": "REFERENCE", "alo_equivalent": "Review by repository group; no code copied.", "integration_note": "Metadata and README inventory only; deeper implementation review required before adopting."})
        try:
            meta = api(f"https://api.github.com/repos/{repo}")
            record.update({
                "status": "available" if not meta.get("archived") else "archived",
                "default_branch": meta.get("default_branch", ""),
                "last_pushed_at": meta.get("pushed_at", ""),
                "license_spdx": (meta.get("license") or {}).get("spdx_id", "NOASSERTION"),
                "license_name": (meta.get("license") or {}).get("name", ""),
                "language": meta.get("language") or "",
                "stars": meta.get("stargazers_count", ""),
                "size_kb": meta.get("size", ""),
                "description": meta.get("description", ""),
                "topics": ";".join(meta.get("topics", [])),
            })
            try:
                head = api(f"https://api.github.com/repos/{repo}/commits/{meta.get('default_branch')}")
                record["head_sha"] = head.get("sha", "")
            except Exception as error:
                record["head_sha"] = f"UNVERIFIED:{type(error).__name__}"
            readme = readme_text(repo)
            record["readme_evidence"] = readme[:1400]
            try:
                license_payload = api(f"https://api.github.com/repos/{repo}/license")
                license_raw = base64.b64decode(license_payload.get("content", "")).decode("utf-8", "replace")
                record["license_file_path"] = license_payload.get("path", "")
                record["license_file_sha256"] = hashlib.sha256(license_raw.encode("utf-8")).hexdigest()
                record["license_file_excerpt"] = re.sub(r"\s+", " ", license_raw).strip()[:700]
                record["license_file_status"] = "contents_fetched"
            except urllib.error.HTTPError as error:
                record["license_file_status"] = f"HTTP_{error.code}"
                record["license_file_excerpt"] = ""
            except Exception as error:
                record["license_file_status"] = f"UNVERIFIED_{type(error).__name__}"
            hardware = re.findall(r".{0,90}(?:CPU|GPU|RAM|memory|CUDA|requirements|install|license|licence).{0,130}", readme, re.I)
            record["hardware_evidence"] = " | ".join(hardware[:8])[:1600]
            spdx = record["license_spdx"]
            record["license_note"] = "Declared permissive license; verify full LICENSE and dependencies." if spdx in {"MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC"} else ("Declared copyleft/nonstandard license; legal review before code reuse." if spdx not in {"", "NOASSERTION"} else "No authoritative SPDX license declaration; treat as all-rights-reserved until verified.")
            license_text = record["license_file_excerpt"].lower()
            if record["status"] != "available":
                disposition, reason = "DEFER", "Repository is archived or unavailable; no integration approved in this pass."
            elif any(term in license_text for term in ("noncommercial", "non-commercial", "elv2", "community license agreement")):
                disposition, reason = "REJECT", "Observed license text includes noncommercial, source-available or model/community restrictions; no commercial adoption without legal permission."
            elif spdx in {"AGPL-3.0", "GPL-3.0", "LGPL-3.0", "LGPL-2.1", "GPL-2.0-only OR BSD-2-Clause"}:
                disposition, reason = "REFERENCE", "Copyleft license declared; architecture reference only pending legal review, no code copied."
            elif record["license_file_status"] != "contents_fetched":
                disposition, reason = "DEFER", "No license file contents retrieved; treat as all-rights-reserved pending review."
            elif spdx in {"MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "zlib"} or any(term in license_text for term in ("mit license", "apache license", "bsd license", "zlib/libpng")):
                if repo in {"cathrynlavery/diagram-design", "coreyhaines31/marketingskills", "blader/humanizer", "huggingface/education-toolkit", "leandromoreira/digital_video_introduction", "0voice/audio_video_streaming", "songguoxs/gpt4o-image-prompts"}:
                    disposition, reason = "ADAPT", "Permissive evidence fetched; adapt only a relevant high-level pattern; no code copy approved without separate full license/dependency review."
                else:
                    disposition, reason = "REFERENCE", "Catalogued for feature comparison only; no adoption approved in this pass."
            else:
                disposition, reason = "DEFER", "License is custom, mixed or nonstandard; legal compatibility review required."
            record["disposition"] = disposition
            record["disposition_reason"] = reason
            record["integration_note"] = reason
        except urllib.error.HTTPError as error:
            record.update({"status": f"HTTP_{error.code}", "license_note": "Repository metadata unavailable; do not infer license or copy code."})
        except Exception as error:
            record.update({"status": f"UNVERIFIED_{type(error).__name__}", "license_note": "Repository metadata unavailable; do not infer license or copy code."})
        rows.append(record)
        print(f"[{number}/{len(unique)}] {repo}: {record['status']} {record['license_spdx']} {record['head_sha'][:10]}", flush=True)
        time.sleep(0.08)
    with out.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)
    (out.parent / "GITHUB_SOURCE_CATALOG_RUN.json").write_text(json.dumps({"generated_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "unique_repositories": len(rows), "malformed_links": RAW_MALFORMED, "method": "GitHub REST repository metadata, default-branch commit, README contents; no code executed", "catalog": out.name}, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(rows)} unique repository records to {out}")

if __name__ == "__main__": main()
