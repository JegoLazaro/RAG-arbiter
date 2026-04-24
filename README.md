⛩️ Anime Arbiter: Multiverse RAG System
The Anime Arbiter is a highly specialized Retrieval-Augmented Generation (RAG) application designed to act as the ultimate historian for anime universes (e.g., Jujutsu Kaisen, My Hero Academia).

It autonomously bypasses wiki security to extract deep lore, cross-references specific manga chapters and anime episodes, vectorizes the data using Google's Gemini Embeddings, stores it in Pinecone, and synthesizes perfectly grounded answers through a sleek Next.js chat interface.

✨ Features
📖 Manga & Anime Cross-Referencing: The system grounds its answers in specific manga chapters and anime episodes, citing exact historical plot points rather than just general character summaries.

🛡️ Stealth Data Discovery & Ingestion: Uses hidden MediaWiki APIs and cloudscraper to bypass Cloudflare anti-bot protections on Fandom wikis to extract raw HTML securely.

🧠 Deep Lore & Chronicles: Separates "General Lore" (character profiles) from "Chronicles" (chapter-by-chapter plot details) for accurate timeline resolution.

🔄 Bulletproof Pipelines: Custom with_retry exponential backoff wrappers for both the Python ingestion scripts and the Next.js backend to flawlessly handle API rate limits (HTTP 429).

💾 State Management: Implements local caching (processed_urls.txt and processed_chapters_log.txt) so interrupted scraping jobs resume exactly where they left off without wasting API credits.

⚡ Streaming UI: Next.js API routes stream Server-Sent Events (NDJSON) back to the client for real-time generation and status logging (the "Hacker Terminal" effect).

🧪 Automated Testing: Full Jest + React Testing Library suite to verify UI rendering and conditional Markdown logic.

🛠️ Tech Stack
Data Pipeline (Python)

Python 3.10+

BeautifulSoup4 (HTML Parsing)

Cloudscraper (Cloudflare Bypass)

LangChain (Recursive Text Splitting)

AI & Database

Google Gemini API (gemini-embedding-001 & gemini-3-flash-preview)

Pinecone Vector Database

Frontend & API (TypeScript)

Next.js 14 (App Router)

React

Tailwind CSS

Jest (Automated Testing)

🚀 Getting Started
1. Prerequisites
You will need Node.js and Python installed on your machine. You also need free accounts for Google AI Studio and Pinecone.

Create a .env file in the root of your project and add the following keys:

Code snippet
# AI & Database Keys
GEMINI_API_KEY="your_google_gemini_api_key"
PINECONE_API_KEY="your_pinecone_api_key"
PINECONE_INDEX_NAME="your_index_name" # e.g., "anime-arbiter-index"
2. Python Backend Setup
Navigate to the directory containing your Python scripts and install the requirements.

Bash
# Create a virtual environment (optional but recommended)
python3 -m venv venv
source venv/bin/activate

# Install requirements
pip install -r requirements.txt
3. Next.js Frontend Setup
Install the Node modules for the web app.

Bash
npm install
📚 Data Ingestion Pipeline
The project uses modular Python scripts separated into two phases: Discovery (finding the target URLs) and Ingestion (scraping and vectorizing the content).

Phase 1: Data Discovery (Target Generation)
Before we can extract lore, we need to generate a master list of URLs to target.

Character Discovery (discover.py) Uses the hidden Fandom MediaWiki API (api.php) to safely bypass Cloudflare and retrieve a complete list of character URLs for a given universe.

Bash
python3 discover.py
Timeline Discovery (discover_chapter.py) Uses BeautifulSoup to scrape a universe's "Volumes & Chapters" hub page, utilizing Regex to extract chronological links to every story chapter and anime episode.

Bash
python3 discover_chapter.py
Phase 2: Data Ingestion & Vectorization
Once the JSON targets are generated, these scripts extract the text, split it into chunks, calculate the 3,072-dimensional embeddings via Gemini, and upload them to Pinecone.

Ingesting Characters (ingest.py) Iterates through the Character JSON, extracts their biographical data and citations via the MediaWiki API, and upserts the chunks.

Bash
python3 ingest.py
Ingesting Timeline/Chapters (ingest_chapters.py) Targets the Plot_Details section of chapter/episode URLs to build the chronological timeline. It utilizes cloudscraper to emulate a real Chrome browser handshake, bypassing advanced anti-bot shields.

Bash
python3 ingest_chapters.py
🧠 The Brain of the Arbiter (route.ts)
The core of the RAG system lives in the Next.js backend at app/api/chat/route.ts. It acts as the orchestration layer between the user, the vector database, and the LLM.

Here is how the pipeline flows when a user asks a question:

NDJSON Streaming: The route initializes a ReadableStream. Instead of waiting for the entire process to finish, it continuously pushes status updates (e.g., "Vectorizing query...", "Scanning the Multiverse...") back to the frontend in real-time, creating a highly responsive "Hacker Terminal" UI experience.

Dynamic Vectorization: The user's latest message is passed to gemini-embedding-001, converting the text prompt into a 3,072-dimensional mathematical vector.

Context Retrieval: The vector is used to query Pinecone for the topK: 10 most semantically relevant chunks of data.

Data Classification: The code dynamically inspects the metadata of the returned vectors. If a chunk contains a chapter_number in its metadata, it is classified as a Chronicle (timeline event). Otherwise, it is classified as Lore (character profile).

Prompt Synthesis: A strict system prompt is constructed. The AI is explicitly instructed to prioritize Chronicles over Lore if there are contradictions, ensuring the AI respects the actual progression of the manga/anime timeline rather than static character traits.

Verdict Generation: The context and the user query are passed to the gemini-3-flash-preview model. The final verdict, along with the mapped citation sources, is streamed back to the client.

Graceful Error Handling: The stream safely catches exact HTTP status codes (like 429 Pinecone Quota Exceeded or 404 Model Not Found) and translates them into user-friendly lore warnings (e.g., "The Arbiter's cursed energy is depleted").

💻 Running the Web App
Once your Pinecone database is populated, start the Next.js development server:

Bash
npm run dev
Navigate to http://localhost:3000 in your browser.

🧪 Automated Testing
This project uses Jest and the React Testing Library to ensure the UI components (specifically the AI chat bubbles and Markdown rendering) do not break during development.

To run the test suite locally:

Bash
npm run test
To run tests in watch mode (auto-reloads when you change files):

Bash
npm run test:watch
CI/CD Integration
The repository includes a GitHub Actions YAML file (.github/workflows/ci.yml). Every time code is pushed to the main branch, a virtual Ubuntu server automatically installs dependencies and runs the Jest test suite. If the tests fail, Vercel deployments are halted, ensuring bugs never reach production.

⚠️ Known Issues & Troubleshooting
Fandom 403 Forbidden Errors: Wiki sites aggressively update their Cloudflare security. If ingest_chapters.py starts failing with 403s, ensure your cloudscraper package is updated to the latest version.

Dimension Mismatch: Ensure you are using gemini-embedding-001 to generate vectors. It outputs 3,072 dimensions. If your Pinecone index was created with 1,536 dimensions (OpenAI standard), the upsert will fail.

Built with Next.js, Pinecone, and Gemini.
