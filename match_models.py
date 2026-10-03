import json
import re

# Load the API models
try:
    with open(r'C:\Users\Prabin\.gemini\antigravity\brain\cb359b34-72ff-4bd7-933f-b95c338e88cf\.system_generated\steps\270\content.md', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Strip markdown code blocks if any
    content = content.replace("```json", "").replace("```", "").strip()
    data = json.loads(content)['data']
except Exception as e:
    print(f"Error loading models: {e}")
    data = []

# Filter to free models only
free_models = [m for m in data if m.get('pricing', {}).get('prompt') == '0' and m.get('pricing', {}).get('completion') == '0']

model_names_requested = [
    "ByteDance: Seedance 2.0",
    "ByteDance: Seedance 2.0 Fast",
    "Alibaba: Wan 2.7",
    "Elephant",
    "Cohere: Rerank 4 Pro",
    "Cohere: Rerank 4 Fast",
    "Cohere: Rerank v3.5",
    "Google: Gemma 4 26B A4B (free)",
    "Google: Gemma 4 31B (free)",
    "Google: Lyria 3 Pro Preview",
    "Google: Lyria 3 Clip Preview",
    "Alibaba: Wan 2.6",
    "ByteDance: Seedance 1.5 Pro",
    "OpenAI: Sora 2 Pro",
    "Google: Veo 3.1",
    "NVIDIA: Nemotron 3 Super (free)",
    "NVIDIA: Llama Nemotron Embed VL 1B V2 (free)",
    "MiniMax: MiniMax M2.5 (free)",
    "Sourceful: Riverflow V2 Pro",
    "Sourceful: Riverflow V2 Fast",
    "Arcee AI: Trinity Large Preview (free)",
    "MoonshotAI: Kimi K2.5",
    "LiquidAI: LFM2.5-1.2B-Thinking (free)",
    "LiquidAI: LFM2.5-1.2B-Instruct (free)",
    "Black Forest Labs: FLUX.2 Klein 4B",
    "ByteDance Seed: Seedream 4.5",
    "Black Forest Labs: FLUX.2 Max",
    "NVIDIA: Nemotron 3 Nano 30B A3B (free)",
    "Sourceful: Riverflow V2 Max Preview",
    "Sourceful: Riverflow V2 Standard Preview",
    "Sourceful: Riverflow V2 Fast Preview",
    "Black Forest Labs: FLUX.2 Flex",
    "Black Forest Labs: FLUX.2 Pro",
    "NVIDIA: Nemotron Nano 12B 2 VL (free)",
    "Qwen: Qwen3 Next 80B A3B Instruct (free)",
    "NVIDIA: Nemotron Nano 9B V2 (free)",
    "OpenAI: gpt-oss-120b (free)",
    "OpenAI: gpt-oss-20b (free)",
    "Z.ai: GLM 4.5 Air (free)",
    "Qwen: Qwen3 Coder 480B A35B (free)",
    "Venice: Uncensored (free)",
    "Google: Gemma 3n 2B (free)",
    "Google: Gemma 3n 4B (free)",
    "Google: Gemma 3 4B (free)",
    "Google: Gemma 3 12B (free)",
    "Google: Gemma 3 27B (free)",
    "Meta: Llama 3.3 70B Instruct (free)",
    "Meta: Llama 3.2 3B Instruct (free)"
]

# Create a mapping for loose matching
output_array = []
print("const AI_MODELS = [")

for req_name in model_names_requested:
    clean_req = re.sub(r'\(free\)', '', req_name).strip().lower()
    
    matched = None
    # 1. Exact match by name
    for m in free_models:
        if m['name'].strip().lower() == clean_req:
            matched = m
            break
            
    # 2. Loose match by words mapping
    if not matched:
        for m in free_models:
            words1 = set(clean_req.split())
            words2 = set(m['name'].strip().lower().split())
            if len(words1.intersection(words2)) >= 2:
                matched = m
                break
                
    if matched:
        print(f"    {{ id: '{matched['id']}', name: '{req_name}' }},")
    else:
        # Fallback to generating id based on patterns if not found in free models array
        # e.g., ByteDance: Seedance 2.0 -> bytedance/seedance-2.0:free
        parts = req_name.split(":", 1)
        if len(parts) == 2:
            provider = parts[0].strip().replace(' ', '-').lower()
            model = parts[1].replace('(free)', '').strip().replace(' ', '-').replace('.', '-').lower()
            fid = f"{provider}/{model}:free"
        else:
            fid = req_name.replace(' ', '-').lower() + ":free"
        
        print(f"    // Guessing ID: {fid}")
        print(f"    {{ id: '{fid}', name: '{req_name}' }},")

print("];")
