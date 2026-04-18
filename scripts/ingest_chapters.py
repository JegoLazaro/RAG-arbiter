import json
import time
import os
import requests
import re
import random
import cloudscraper
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# The AI & Database Libraries
from pinecone import Pinecone
from google import genai 
from langchain_text_splitters import RecursiveCharacterTextSplitter 

# ==========================================
# 1. SETUP & ENVIRONMENT
# ==========================================
load_dotenv() 

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")
UNIVERSE_NAME = "Jujutsu Kaisen"
JSON_FILE = "jujutsu_kaisen_chapters_links.json"
PROCESSED_LEDGER = "processed_chapters_urls.txt"

# ==========================================
# 2. HACKER TERMINAL VISUALS
# ==========================================
def mem_hash():
    return f"0x{hex(random.getrandbits(32))[2:].zfill(8).upper()}"

def sys_log(tag, message):
    print(f"[{mem_hash()}] [{tag}] {message}")

# ==========================================
# 3. DEFINE FUNCTIONS & RETRY PROTOCOL
# ==========================================

# --- NEW: Universal 429 Retry Shield ---
def with_retry(func, operation_name, max_retries=4):
    """Universal retry wrapper for handling 429 Rate Limits across all APIs."""
    attempt = 0
    while attempt <= max_retries:
        try:
            return func()
        except Exception as e:
            error_msg = str(e).lower()
            # Catch Gemini, Pinecone, or Cloudflare rate limits
            if "429" in error_msg or "rate limit" in error_msg or "too many requests" in error_msg:
                if attempt < max_retries:
                    attempt += 1
                    # Exponential backoff: 15s, 30s, 45s, 60s...
                    delay = attempt * 15 
                    sys_log("WARN", f"429 RATE LIMIT DETECTED ON {operation_name}. REROUTING... RETRY IN {delay}s (ATTEMPT {attempt}/{max_retries})")
                    time.sleep(delay)
                else:
                    sys_log("FATAL", f"MAX RETRIES EXCEEDED ON {operation_name}. CONNECTION SEVERED.")
                    raise e
            else:
                # If it's a different error (like a 404 or missing variable), crash normally
                raise e
# ---------------------------------------

def load_processed_ledger():
    if not os.path.exists(PROCESSED_LEDGER): return set()
    with open(PROCESSED_LEDGER, 'r', encoding='utf-8') as f:
        return set(line.strip() for line in f)

def mark_as_processed(chapter_name):
    with open(PROCESSED_LEDGER, 'a', encoding='utf-8') as f:
        f.write(chapter_name + "\n")

def get_embedding(text):
    client = genai.Client(api_key=GEMINI_API_KEY)
    response = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
    )
    # Note: Using response.embeddings.values based on your V2 structure
    return [float(x) for x in response.embeddings[0].values]

def get_chapter_summary(chapter_url):
    """Bypasses Cloudflare and extracts the DEEP PLOT details explicitly."""
    scraper = cloudscraper.create_scraper(
        browser={'browser': 'chrome', 'platform': 'windows', 'desktop': True}
    )
    
    try:
        response = with_retry(lambda: scraper.get(chapter_url, timeout=15), "WEB SCRAPER")
        
        if response.status_code != 200: 
            sys_log("ERR", f"CLOUDFLARE SHIELD ACTIVE. HTTP STATUS: {response.status_code}")
            return ""
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # EXPLICIT TARGETING: Check for Plot_Details first, then fall back to the others
        target_span = (
            soup.find(id='Plot_Details') or 
            soup.find(id='Plot') or 
            soup.find(id='Synopsis') or 
            soup.find(id='Summary')
        )
        
        content_parts = []
        if target_span:
            # Handle if the ID is on a span inside the header, or directly on the header
            parent_h2 = target_span if target_span.name in ['h2', 'h3'] else target_span.find_parent(['h2', 'h3'])
            
            if parent_h2:
                for sibling in parent_h2.find_next_siblings():
                    if sibling.name == 'h2': 
                        break
                    
                    if sibling.name in ['p', 'ul', 'h3', 'h4']: 
                        text = sibling.get_text(separator=' ', strip=True)
                        if text and "Navigation" not in text: 
                            content_parts.append(text)
                            
        return "\n\n".join(content_parts)
    except Exception as e:
        sys_log("ERR", f"PARSING EXCEPTION ON TARGET {chapter_url}: {e}")
        return ""

def extract_chapter_number(name):
    match = re.search(r'Chapter\s+(\d+)', name)
    return int(match.group(1)) if match else None

# ==========================================
# 4. INITIALIZE & LOOP
# ==========================================
sys_log("INIT", "INITIALIZING SECURE NEURAL LINK TO PINECONE CLUSTER...")
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX_NAME)
sys_log("INIT", "VECTOR DATABASE HANDSHAKE SUCCESSFUL.")

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=700,
    chunk_overlap=150,
    separators=["\n\n", "\n", ".", " "]
)

def run_chapter_ingestion():
    if not os.path.exists(JSON_FILE):
        sys_log("FATAL", f"TARGET PAYLOAD {JSON_FILE} NOT FOUND. ABORTING.")
        return

    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        chapters = json.load(f)

    processed_chapters = load_processed_ledger()

    print("\n" + "="*70)
    sys_log("SYS", f"COMMENCING LORE SYNCHRONIZATION: {len(chapters)} CHRONICLES DETECTED.")
    sys_log("SYS", f"LOCAL CACHE: {len(processed_chapters)} CHRONICLES ALREADY IN DATABANKS.")
    print("="*70 + "\n")

    for chap in chapters:
        name = chap['name']
        url = chap['url']
        chap_num = extract_chapter_number(name)

        if name in processed_chapters:
            sys_log("SKIP", f"CACHE HIT: {name.upper()} PREVIOUSLY SYNCHRONIZED. BYPASSING...")
            continue

        sys_log("EXTRACT", f"TARGET ACQUIRED: {name.upper()}. INJECTING SPOOFED HEADERS...")
        raw_text = get_chapter_summary(url)
        
        if not raw_text or len(raw_text.strip()) < 100:
            sys_log("WARN", f"PAYLOAD CORRUPTED OR EMPTY FOR {name}. BYPASSING...")
            mark_as_processed(name) 
            continue
            
        chunks = text_splitter.split_text(raw_text)
        sys_log("TENSOR", f"DATA FRAGMENTED INTO {len(chunks)} HIGH-DENSITY CHUNKS. ENGAGING VECTORIZATION...")
        vectors_to_upload = []

        for i, chunk in enumerate(chunks):
            try:
                # Wrapped in the retry shield
                vector_values = with_retry(lambda: get_embedding(chunk), "TENSOR VECTORIZATION")
                
                vectors_to_upload.append({
                    "id": f"PLOT_CH{chap_num}_{i}" if chap_num else f"PLOT_{name}_{i}",
                    "values": vector_values,
                    "metadata": {
                        "universe": UNIVERSE_NAME,
                        "character": "Plot Event",
                        "name": name,             
                        "chapter_number": chap_num,
                        "text": chunk,
                        "citations": json.dumps({f"Chapter": str(chap_num) if chap_num else name})
                    }
                })
            except Exception as e:
                sys_log("ERR", f"VECTORIZATION FAILURE ON FRAGMENT {i}: {e}")

        if vectors_to_upload:
            sys_log("NET", f"UPLOADING 3,072-DIMENSIONAL TENSOR BATCH TO NAMESPACE...")
            
            # Wrapped in the retry shield
            with_retry(lambda: index.upsert(vectors=vectors_to_upload), "PINECONE UPLOAD")
            
            mark_as_processed(name)
            sys_log("SUCCESS", f"{name.upper()} SECURELY WRITTEN TO DATABANKS.\n")
        
        time.sleep(3) 

if __name__ == "__main__":
    run_chapter_ingestion()