# GitHub source license and disposition matrix

> Metadata, README and available license-file evidence collected from GitHub REST API on 2026-10-18. 135 unique normalized URLs. Default-branch SHAs, SPDX declaration, license-file path/hash and README excerpts are in `GITHUB_SOURCE_CATALOG.csv`. This is preliminary engineering/legal triage, not legal advice or full source/dependency review.

**Counts:** status {'available': 129, 'archived': 2, 'HTTP_404': 4}; declared SPDX {'AGPL-3.0': 11, 'MIT': 50, 'NOASSERTION': 41, 'Apache-2.0': 19, 'LGPL-3.0': 1, 'GPL-3.0': 7, 'LGPL-2.1': 1, 'BSD-3-Clause': 1, 'NO_METADATA': 4}; disposition {'REFERENCE': 89, 'ADAPT': 4, 'DEFER': 37, 'REJECT': 5}.

## Decision rules

- `ADAPT`: relevant high-level behavior/design pattern only. No source-code reuse approved; inspect full license, dependencies, notices and assets before copying.
- `REFERENCE`: feature/architecture comparison only; no code or weights copied.
- `DEFER`: unavailable, no authoritative license evidence, or custom/composite terms need review.
- `REJECT`: observed noncommercial/source-available/model-community restrictions conflict with intended commercial use absent written permission.
- `INTEGRATE`: none approved in this pass.

## Per-repository ledger

| Repository | status | branch SHA | SPDX | license file | disposition | reason |
|---|---|---|---|---|---|---|
| [`tooljet/tooljet`](https://github.com/tooljet/tooljet) | available | `aa67409c2ab2` | AGPL-3.0 | LICENSE | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`cathrynlavery/diagram-design`](https://github.com/cathrynlavery/diagram-design) | available | `550fd66edff0` | MIT | LICENSE | **ADAPT** | Permissive evidence fetched; adapt only a relevant high-level pattern; no code copy approved without separate full license/dependency review. |
| [`omacom/omarchy`](https://github.com/omacom/omarchy) | available | `12a293b0aae7` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`cursor/plugins`](https://github.com/cursor/plugins) | available | `0b8e952052d4` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`aprilnea/openlogi`](https://github.com/aprilnea/openlogi) | available | `abc815acf9eb` | Apache-2.0 | LICENSE-APACHE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`volcengine/openviking`](https://github.com/volcengine/openviking) | available | `0fcc16638119` | AGPL-3.0 | LICENSE | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`affaan-m/ecc`](https://github.com/affaan-m/ecc) | available | `76aaa77df6ad` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`mksglu/context-mode`](https://github.com/mksglu/context-mode) | available | `23e81ab3a027` | NOASSERTION | LICENSE | **REJECT** | Observed license text includes noncommercial, source-available or model/community restrictions; no commercial adoption without legal permission. |
| [`jetbrains/go-modern-guidelines`](https://github.com/jetbrains/go-modern-guidelines) | available | `155dc7ca10da` | Apache-2.0 | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`tt-a1i/archify`](https://github.com/tt-a1i/archify) | available | `208acba8d412` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`bilawalsidhu/gods-eye-view`](https://github.com/bilawalsidhu/gods-eye-view) | available | `93ea088f4556` | NOASSERTION | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`braamohammed/bricks`](https://github.com/braamohammed/bricks) | available | `586186e0d71d` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`fmtlib/fmt`](https://github.com/fmtlib/fmt) | available | `0fc31633e7d5` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`cline/cline`](https://github.com/cline/cline) | available | `a42df8c8d5fd` | Apache-2.0 | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`vastsa/pi-desktop`](https://github.com/vastsa/pi-desktop) | available | `589e5803a7a9` | LGPL-3.0 | LICENSE | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`ruvnet/ruflo`](https://github.com/ruvnet/ruflo) | available | `b93144803bb1` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`foundationagents/metagpt`](https://github.com/foundationagents/metagpt) | available | `11cdf466d042` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`gitlawb/openclaude`](https://github.com/gitlawb/openclaude) | available | `933019b6a9fa` | NOASSERTION | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`k-dense-ai/scientific-agent-skills`](https://github.com/k-dense-ai/scientific-agent-skills) | available | `a1043ef544e3` | MIT | LICENSE.md | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`akitaonrails/ai-memory`](https://github.com/akitaonrails/ai-memory) | available | `995e35d58669` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`efficientstreet/hindsight`](https://github.com/efficientstreet/hindsight) | available | `d43d7282058b` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`sulabhdubey/rta-smriti-brain`](https://github.com/sulabhdubey/rta-smriti-brain) | available | `8ec834a9d1f5` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`artistsyn/cortex_suite`](https://github.com/artistsyn/cortex_suite) | available | `1e739dcfe86d` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`timharris707/modeldeck`](https://github.com/timharris707/modeldeck) | available | `f3dfe712df3f` | NOASSERTION | LICENSE.md | **REJECT** | Observed license text includes noncommercial, source-available or model/community restrictions; no commercial adoption without legal permission. |
| [`jingyaogong/minimind`](https://github.com/jingyaogong/minimind) | available | `f659b55761b7` | Apache-2.0 | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`huggingface/education-toolkit`](https://github.com/huggingface/education-toolkit) | archived | `e0339f873e61` | Apache-2.0 | LICENSE | **DEFER** | Repository is archived or unavailable; no integration approved in this pass. |
| [`meta-models/meta-model-cookbook`](https://github.com/meta-models/meta-model-cookbook) | available | `0a99b987858e` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`zai-org/glm-5`](https://github.com/zai-org/glm-5) | available | `83c03d317378` | Apache-2.0 | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`thu-ml/crm`](https://github.com/thu-ml/crm) | available | `4964e36a5930` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`ioi-labs/molx`](https://github.com/ioi-labs/molx) | available | `149a126e767e` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`thu-maic/openmaic`](https://github.com/thu-maic/openmaic) | available | `6b83751a8789` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`tinystruct/smalltalk`](https://github.com/tinystruct/smalltalk) | available | `4225688cffbb` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`nashsu/llm_wiki`](https://github.com/nashsu/llm_wiki) | available | `48fd970e206a` | NOASSERTION | LICENSE | **DEFER** | License is custom, mixed or nonstandard; legal compatibility review required. |
| [`coreyhaines31/marketingskills`](https://github.com/coreyhaines31/marketingskills) | available | `365b412152b9` | MIT | LICENSE | **ADAPT** | Permissive evidence fetched; adapt only a relevant high-level pattern; no code copy approved without separate full license/dependency review. |
| [`every-app/open-seo`](https://github.com/every-app/open-seo) | available | `d7ea78524806` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`firecrawl/firecrawl`](https://github.com/firecrawl/firecrawl) | available | `7ccc8f4e9957` | AGPL-3.0 | LICENSE | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`firecrawl/web-agent`](https://github.com/firecrawl/web-agent) | available | `f023adf1cd1f` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`guifav/market-intelligence-radar`](https://github.com/guifav/market-intelligence-radar) | available | `a65c43c1244e` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`parthasarathy123/n8n-gtm-lead-enrichment`](https://github.com/parthasarathy123/n8n-gtm-lead-enrichment) | available | `3d3190787bf3` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`brightdata/open-enrich`](https://github.com/brightdata/open-enrich) | available | `301af4b42131` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`clawnify/openprospector`](https://github.com/clawnify/openprospector) | available | `b93109ba8512` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`diygod/rsshub`](https://github.com/diygod/rsshub) | available | `eb7d2c75e4c9` | AGPL-3.0 | LICENSE | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`public-apis/public-apis`](https://github.com/public-apis/public-apis) | available | `a8f43609edba` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`mohamed11sk/email-markting`](https://github.com/mohamed11sk/email-markting) | available | `4ade48ee211b` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`knsoftic/email_markting`](https://github.com/knsoftic/email_markting) | available | `af845ed8987b` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`workwithlos-ui/dave`](https://github.com/workwithlos-ui/dave) | available | `451de7bccd38` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`melgarafael/deskcommcrm`](https://github.com/melgarafael/deskcommcrm) | available | `bc9529df939b` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`django-crm/django-crm`](https://github.com/django-crm/django-crm) | available | `4022f914af08` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`odoo-mobile/crm`](https://github.com/odoo-mobile/crm) | available | `b25516b8f745` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`dennisivy/crash-course-crm`](https://github.com/dennisivy/crash-course-crm) | available | `f250e3984e30` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`oroinc/crm-application`](https://github.com/oroinc/crm-application) | available | `34c2fa4957f6` | NOASSERTION | LICENSE | **DEFER** | License is custom, mixed or nonstandard; legal compatibility review required. |
| [`oroinc/crm`](https://github.com/oroinc/crm) | available | `a37c3995f055` | NOASSERTION | LICENSE | **DEFER** | License is custom, mixed or nonstandard; legal compatibility review required. |
| [`trycompai/crm`](https://github.com/trycompai/crm) | available | `6d4793dd6d7a` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`frappe/crm`](https://github.com/frappe/crm) | available | `239904bfed47` | AGPL-3.0 | LICENSE | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`churchcrm/crm`](https://github.com/churchcrm/crm) | available | `cebf3b49b553` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`crmeb/crmeb`](https://github.com/crmeb/crmeb) | available | `da8d3b93400f` | Apache-2.0 | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`idurar/idurar-erp-crm`](https://github.com/idurar/idurar-erp-crm) | available | `e935dec13cf8` | AGPL-3.0 | LICENSE | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`fatfreecrm/fat_free_crm`](https://github.com/fatfreecrm/fat_free_crm) | available | `91595c40a6ba` | NOASSERTION | MIT-LICENSE | **DEFER** | License is custom, mixed or nonstandard; legal compatibility review required. |
| [`twentyhq/twenty`](https://github.com/twentyhq/twenty) | available | `dd7099a02f83` | NOASSERTION | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`nabaleducation/educationconsultancywebsite`](https://github.com/nabaleducation/educationconsultancywebsite) | available | `e451b3d9ee18` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`arupdas0825/studytra`](https://github.com/arupdas0825/studytra) | available | `17f48ef12ec4` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`bhawana0218/nextstep-abroad`](https://github.com/bhawana0218/nextstep-abroad) | available | `c033efa1114c` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`nwuzmedoutlook/university`](https://github.com/nwuzmedoutlook/university) | available | `81761fb4b503` | Apache-2.0 | License | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`arnasdon/wacrm`](https://github.com/arnasdon/wacrm) | available | `34bce1a8abf5` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`chatwoot/chatwoot`](https://github.com/chatwoot/chatwoot) | available | `972567d7442b` | NOASSERTION | LICENSE | **DEFER** | License is custom, mixed or nonstandard; legal compatibility review required. |
| [`domovinatv/sms.domovina.ai`](https://github.com/domovinatv/sms.domovina.ai) | available | `51403b576e91` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`ndolestudio/httpsms`](https://github.com/ndolestudio/httpsms) | available | `b4527e8a572e` | AGPL-3.0 | LICENSE | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`ndolestudio/httpsms-node`](https://github.com/ndolestudio/httpsms-node) | available | `0a6f5ee2de56` | MIT | license | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`belledonnecommunications/linphone-iphone`](https://github.com/belledonnecommunications/linphone-iphone) | available | `520d51addf40` | GPL-3.0 | LICENSE.txt | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`0perationprivacy/voip`](https://github.com/0perationprivacy/voip) | available | `e4a3885e0c58` | GPL-3.0 | LICENSE | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`developerspace-samples/voip-call-sample`](https://github.com/developerspace-samples/voip-call-sample) | available | `6151e003e467` | Apache-2.0 | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`jitsi/jitsi-videobridge`](https://github.com/jitsi/jitsi-videobridge) | available | `2e51c253e8f5` | Apache-2.0 | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`sibnerian/electron-promise-ipc`](https://github.com/sibnerian/electron-promise-ipc) | available | `72bb077904ae` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`capsoftware/cap`](https://github.com/capsoftware/cap) | available | `207aaf116f27` | NOASSERTION | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`nextcloud/server`](https://github.com/nextcloud/server) | available | `5a401a1521b7` | AGPL-3.0 | COPYING | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`siyuan-note/siyuan`](https://github.com/siyuan-note/siyuan) | available | `7a7430d8a3cf` | AGPL-3.0 | LICENSE | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`dani-garcia/vaultwarden`](https://github.com/dani-garcia/vaultwarden) | available | `58a980f85046` | AGPL-3.0 | LICENSE.txt | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`tryghost/ghost`](https://github.com/tryghost/ghost) | available | `d4952f1dec90` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`umami-software/umami`](https://github.com/umami-software/umami) | available | `ec0ff50388c2` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`languagetool-org/languagetool`](https://github.com/languagetool-org/languagetool) | available | `ce17307ac8af` | LGPL-2.1 | COPYING.txt | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`debpalash/voicestudio`](https://github.com/debpalash/voicestudio) | available | `d819ff54d930` | AGPL-3.0 | LICENSE | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`heygen-com/hyperframes`](https://github.com/heygen-com/hyperframes) | available | `c8288eb9b65c` | Apache-2.0 | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`harry0703/moneyprinterturbo`](https://github.com/harry0703/moneyprinterturbo) | available | `9e7d8b7efa6b` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`hm-runninghub/comfyui_rh_apicall`](https://github.com/hm-runninghub/comfyui_rh_apicall) | available | `8fc4f5482123` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`weifeng2333/videocaptioner`](https://github.com/weifeng2333/videocaptioner) | available | `95842ecb5618` | GPL-3.0 | LICENSE | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`ath-maas/pixelle-video`](https://github.com/ath-maas/pixelle-video) | available | `848b054e4fae` | Apache-2.0 | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`remotion-dev/remotion`](https://github.com/remotion-dev/remotion) | available | `0c7e230d8349` | NOASSERTION | LICENSE.md | **DEFER** | License is custom, mixed or nonstandard; legal compatibility review required. |
| [`marktechstation/videocode`](https://github.com/marktechstation/videocode) | available | `b05293d86aa3` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`3b1b/videos`](https://github.com/3b1b/videos) | available | `306a1346a356` | NOASSERTION | LICENSE.txt | **REJECT** | Observed license text includes noncommercial, source-available or model/community restrictions; no commercial adoption without legal permission. |
| [`bradautomates/claude-video`](https://github.com/bradautomates/claude-video) | available | `03ceb42f7fa2` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`meigen-ai/infinitetalk`](https://github.com/meigen-ai/infinitetalk) | available | `50aa0a941843` | Apache-2.0 | LICENSE.txt | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`zai-org/cogvideo`](https://github.com/zai-org/cogvideo) | available | `7a1af7154511` | Apache-2.0 | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`tencent-hunyuan/hunyuanvideo`](https://github.com/tencent-hunyuan/hunyuanvideo) | available | `4eda9cb44c3b` | NOASSERTION | LICENSE.txt | **REJECT** | Observed license text includes noncommercial, source-available or model/community restrictions; no commercial adoption without legal permission. |
| [`lightricks/ltx-video`](https://github.com/lightricks/ltx-video) | available | `4b2d05305762` | Apache-2.0 | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`opentalker/video-retalking`](https://github.com/opentalker/video-retalking) | available | `d32e8e582482` | Apache-2.0 | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`meituan-longcat/longcat-video`](https://github.com/meituan-longcat/longcat-video) | available | `6b3f4b8582a8` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`hitsz-tmg/videoclaw`](https://github.com/hitsz-tmg/videoclaw) | available | `16c1ce0b553e` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`hkuds/videoagent`](https://github.com/hkuds/videoagent) | available | `f207987e3cff` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`loseall/videosuperresolution`](https://github.com/loseall/videosuperresolution) | available | `4c86e49d81c7` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`augani/openreel-video`](https://github.com/augani/openreel-video) | available | `367d7e90b61b` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`kosinkadink/comfyui-videohelpersuite`](https://github.com/kosinkadink/comfyui-videohelpersuite) | available | `4d907bee61e9` | GPL-3.0 | LICENSE | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`elebumm/redditvideomakerbot`](https://github.com/elebumm/redditvideomakerbot) | available | `569f25098a64` | GPL-3.0 | LICENSE | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`gair-nlp/livetalk`](https://github.com/gair-nlp/livetalk) | available | `e0d555fc5edf` | NOASSERTION | LICENSE.md | **REJECT** | Observed license text includes noncommercial, source-available or model/community restrictions; no commercial adoption without legal permission. |
| [`armory3d/armorpaint`](https://github.com/armory3d/armorpaint) | available | `9190a9398fa6` | NOASSERTION | license.md | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`google-research/timesfm`](https://github.com/google-research/timesfm) | available | `e51928e27119` | Apache-2.0 | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`yaofanguk/video-subtitle-remover`](https://github.com/yaofanguk/video-subtitle-remover) | available | `e109b9ddc1d0` | Apache-2.0 | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`leandromoreira/digital_video_introduction`](https://github.com/leandromoreira/digital_video_introduction) | available | `7b32ff5d6520` | BSD-3-Clause | LICENSE | **ADAPT** | Permissive evidence fetched; adapt only a relevant high-level pattern; no code copy approved without separate full license/dependency review. |
| [`0voice/audio_video_streaming`](https://github.com/0voice/audio_video_streaming) | available | `1b12e92a10a2` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`dunossauro/videomaker-helper`](https://github.com/dunossauro/videomaker-helper) | available | `9750a2daf94c` | GPL-3.0 | license.txt | **REFERENCE** | Copyleft license declared; architecture reference only pending legal review, no code copied. |
| [`burhankocabiyik/videomaker`](https://github.com/burhankocabiyik/videomaker) | available | `d1de12ec0ceb` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`wtz2017/videomaker`](https://github.com/wtz2017/videomaker) | available | `49fb88898412` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`viniciusenari/slideshow-videomaker`](https://github.com/viniciusenari/slideshow-videomaker) | available | `95bde49c554a` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`wutao-cs/videomaker`](https://github.com/wutao-cs/videomaker) | available | `4941a8fdb5db` | NOASSERTION | LICENSE | **DEFER** | License is custom, mixed or nonstandard; legal compatibility review required. |
| [`shubhamdevhouse/animated-videomaker`](https://github.com/shubhamdevhouse/animated-videomaker) | available | `b89cc33c9cd1` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`seed0001/videomaker`](https://github.com/seed0001/videomaker) | available | `ecbe2d6177a3` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`bilal-belli/videomakerbot`](https://github.com/bilal-belli/videomakerbot) | available | `0fd8f1a35722` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`nncstudio/videomakerpro`](https://github.com/nncstudio/videomakerpro) | available | `eb306e7b1007` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`alsk1992/cloddsbot`](https://github.com/alsk1992/cloddsbot) | available | `c930628c47a4` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`lakr233/vphone-cli`](https://github.com/lakr233/vphone-cli) | available | `61b4efb27da3` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`blader/humanizer`](https://github.com/blader/humanizer) | available | `8c307f367c91` | MIT | LICENSE | **ADAPT** | Permissive evidence fetched; adapt only a relevant high-level pattern; no code copy approved without separate full license/dependency review. |
| [`yutarohayakawa/ipftrace2`](https://github.com/yutarohayakawa/ipftrace2) | available | `4bd7dcfbbd8b` | NOASSERTION | LICENSE | **DEFER** | License is custom, mixed or nonstandard; legal compatibility review required. |
| [`onyx-dev-labs`](https://github.com/onyx-dev-labs) | HTTP_404 | `` | NOASSERTION |  | **DEFER** | Repository is archived or unavailable; no integration approved in this pass. |
| [`kayforkind/reimagine-it`](https://github.com/kayforkind/reimagine-it) | available | `e8c93788bd76` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`templetongroup/radiant`](https://github.com/templetongroup/radiant) | available | `1039826e9642` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`efficientstreet/youtube-subscriptions-ingest`](https://github.com/efficientstreet/youtube-subscriptions-ingest) | available | `26f91e3264c4` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`ramon-victor/freegpt-webui`](https://github.com/ramon-victor/freegpt-webui) | archived | `098db3dfeb41` | GPL-3.0 | LICENSE | **DEFER** | Repository is archived or unavailable; no integration approved in this pass. |
| [`lin-jun-xiang/docgpt-langchain`](https://github.com/lin-jun-xiang/docgpt-langchain) | available | `f369908cfc5c` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`teremterem/claude-code-gpt-5-codex`](https://github.com/teremterem/claude-code-gpt-5-codex) | available | `6fa57684eccb` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`getgoapi/free-gpt-grok-gemini-claude-api`](https://github.com/getgoapi/free-gpt-grok-gemini-claude-api) | available | `d142d31cfad1` | MIT | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`anthropics/claude-plugins-community`](https://github.com/anthropics/claude-plugins-community) | available | `06ec7b6a0a82` | Apache-2.0 | LICENSE | **REFERENCE** | Catalogued for feature comparison only; no adoption approved in this pass. |
| [`songguoxs/gpt4o-image-prompts`](https://github.com/songguoxs/gpt4o-image-prompts) | available | `c282b673debc` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`tech360-bd/alo_web_crm_tech`](https://github.com/tech360-bd/alo_web_crm_tech) | available | `ef7fb8b2b50e` | NOASSERTION | HTTP_404 | **DEFER** | No license file contents retrieved; treat as all-rights-reserved pending review. |
| [`engralaminn-collab/alo-education-uk-final`](https://github.com/engralaminn-collab/alo-education-uk-final) | HTTP_404 | `` | NOASSERTION |  | **DEFER** | Repository is archived or unavailable; no integration approved in this pass. |
| [`engralaminn-collab/ukvi-ai-markting_n8n`](https://github.com/engralaminn-collab/ukvi-ai-markting_n8n) | HTTP_404 | `` | NOASSERTION |  | **DEFER** | Repository is archived or unavailable; no integration approved in this pass. |
| [`engralaminn-collab/ai-markting-crm`](https://github.com/engralaminn-collab/ai-markting-crm) | HTTP_404 | `` | NOASSERTION |  | **DEFER** | Repository is archived or unavailable; no integration approved in this pass. |

## Licensing cautions

- GitHub SPDX metadata does not establish that every component in a repository shares the same license.
- Model code, weights, datasets and usage can have separate terms. No weights were downloaded or run.
- `NOASSERTION` means GitHub did not parse an SPDX identifier; fetched files can still contain mixed/custom terms.
- The ALO repository is declared MIT; do not incorporate copyleft code without separate legal compatibility review.
- `https://github.com/Onyx-Dev-Labs` is an owner page, not a repo path; API returned 404.
- The malformed concatenated RedditVideoMakerBot/OpenTalker URL was normalized into two independently valid repositories.
- Three ALO repository URLs returned 404 and may be private, moved or misspelled. No content/license inferred.
- No third-party source was cloned or executed; this is not a code audit.
