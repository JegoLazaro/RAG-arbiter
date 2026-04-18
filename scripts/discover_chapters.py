import requests
from bs4 import BeautifulSoup
import json
import os
import re

WIKI_URL = "https://jujutsu-kaisen.fandom.com/wiki/Volumes_%26_Chapters"
BASE_URL = "https://jujutsu-kaisen.fandom.com"
OUTPUT_FILE = "jujutsu_kaisen_chapters.json"

def discover_chapters():
    print(f"🔍 Accessing {WIKI_URL}...")
    headers = {'User-Agent': 'AnimeArbiterBot/1.0'}
    
    try:
        response = requests.get(WIKI_URL, headers=headers)
        if response.status_code != 200:
            print(f"❌ Failed to fetch page. Status: {response.status_code}")
            print(f"   Response: {response.text}...")  
            return

        soup = BeautifulSoup(response.text, 'html.parser')
        chapters = []
        
        # IMPROVEMENT: Focus on the main content area to avoid sidebar/footer links
        content_area = soup.find('div', {'class': 'mw-parser-output'})
        if not content_area:
            content_area = soup # Fallback if specific div isn't found
            
        links = content_area.find_all('a', href=True)
        
        for link in links:
            href = link['href']
            # Get the text inside the link, which is often "Chapter 1"
            link_text = link.get_text().strip()
            title = link.get('title', '')
            
            # IMPROVEMENT: Use Regex for stricter filtering
            # We want strings that look like "Chapter 123" but NOT "Volume 10" or "Category:"
            is_chapter_link = re.search(r'Chapter_\d+', href) or re.search(r'Chapter \d+', link_text)
            
            if is_chapter_link and "/wiki/" in href:
                # Exclude administrative pages and Volumes
                if not any(x in href for x in [":", "Volume", "List_of", "File", "Action"]):
                    
                    # Clean the name (e.g., "Chapter 1" instead of "Chapter 1/Summary")
                    name = link_text if "Chapter" in link_text else title
                    if not name:
                        name = href.split('/')[-1].replace('_', ' ')

                    chapter_data = {
                        "name": name,
                        "url": BASE_URL + href
                    }
                    
                    # Deduplicate by URL
                    if not any(c['url'] == chapter_data['url'] for c in chapters):
                        chapters.append(chapter_data)

        # Sort chapters numerically if possible (helpful for logging)
        try:
            chapters.sort(key=lambda x: int(re.search(r'\d+', x['name']).group()) if re.search(r'\d+', x['name']) else 0)
        except:
            pass

        print(f"✅ Found {len(chapters)} unique chapters.")
        
        with open(OUTPUT_FILE, "w", encoding='utf-8') as f:
            json.dump(chapters, f, indent=4)
        print(f"💾 Saved to {OUTPUT_FILE}")

    except Exception as e:
        print(f"❌ Error during discovery: {e}")

if __name__ == "__main__":
    discover_chapters()