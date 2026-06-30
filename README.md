# ⛩️ The Anime Arbiter: Multiverse RAG AI

The Anime Arbiter is a production-grade, streaming AI chat application powered by Retrieval-Augmented Generation (RAG). It acts as an omniscient historian, capable of retrieving highly specific lore, character feats, and chronological events across multiple anime universes (e.g., *Jujutsu Kaisen*, *Demon Slayer*, *My Hero Academia*, *Demon Slayer - Kimetsu No Yaiba*). 

Built with **Next.js**, **Google Gemini**, and **Pinecone**, the system features a custom two-step LLM routing architecture, conversational memory, and robust endpoint protection via **Upstash Redis**.

---

## 🚀 Key Features

* **Multiverse Vector Search:** Queries a Pinecone vector database segmented by namespaces to retrieve cross-universe lore without data bleed.
* **The "Combo Router" Architecture:** A custom, ultra-fast pre-processing step where an LLM analyzes user intent, determines the required anime universe, and resolves conversational pronouns (amnesia fix) in a single pass before hitting the database.
* **Conversational Memory:** The AI remembers previous turns, allowing users to ask natural follow-up questions (e.g., *"Who is Gojo?"* -> *"What is his domain?"*).
* **Automated Data Pipeline:** Custom Node.js scripts (`discover` and `ingest`) using **LangChain** to automatically scrape, chunk, and vectorize character wikis and manga chapter summaries into the Pinecone index.
* **Enterprise Rate Limiting:** API routes are shielded by **Upstash Redis**, utilizing a sliding window algorithm to prevent quota abuse and wallet drain.
* **Real-time Streaming UI:** Answers and thought-process statuses are streamed back to the frontend chunk-by-chunk using the Web Streams API for a low-latency, ChatGPT-like experience.
* **Rich Markdown Rendering:** Supports tables, blockquotes, and lists with GitHub Flavored Markdown (GFM) and custom Tailwind CSS integrations.

---

## 🛠️ Tech Stack

### Frontend
* **Framework:** Next.js (React)
* **Styling:** Tailwind CSS (with Dark Mode support)
* **Icons:** Lucide React
* **Markdown:** `react-markdown` with `remark-gfm`

### Backend & AI
* **Framework:** Next.js Route Handlers (Edge/Node)
* **LLM Provider:** Google Gemini API (`gemini-1.5-flash`, `gemini-3-flash-preview`)
* **Embedding Model:** Google `text-embedding-001`
* **Vector Database:** Pinecone
* **Caching & Security:** Upstash Redis & `@upstash/ratelimit`
* **Data Processing:** LangChain (`langchain/text_splitters`, `langchain/document_loaders`)

---

## 🧠 Architecture Flow

When a user submits a message, the request goes through a strict, multi-stage pipeline:

1. **The Gatekeeper (Upstash):** The user's IP is checked against a Redis sliding window. If they exceed 10 requests per minute, the API returns a 429 error, saving AI quotas.
2. **The Combo Router (Gemini):** The chat history and latest message are sent to a fast LLM. It returns a JSON payload determining:
   * Do we need to search the database?
   * Which specific anime namespaces should we query?
   * A "condensed" search query that replaces pronouns (e.g., *"his domain"* -> *"Gojo's domain"*).
3. **The Multiverse Query (Pinecone):** The condensed query is vectorized and sent to Pinecone. The system queries multiple namespaces in parallel using `Promise.all()`, filtering and sorting the top matches.
4. **The Arbiter Synthesis (Gemini):** The retrieved chunks (Lore & Chronicles) are injected into a strict system prompt. The final LLM synthesizes the exact answer, prioritizing chronological chapter events over general lore.
5. **The Data Stream:** The final payload (Text + Sources array) is streamed to the frontend UI.

---

## 🗄️ The Data Ingestion Pipeline

To populate the Arbiter's knowledge base, this repo includes a two-part data pipeline using LangChain:

* **`discover.ts`**: Crawls specified wiki directories or APIs to map out character pages, abilities, and chapter summaries, saving the raw text data locally.
* **`ingest.ts`**: Uses LangChain's Text Splitters to chunk the raw data into optimized token sizes, vectorizes them using Gemini's embedding model, and upserts them into Pinecone with rich metadata (character names, chapter numbers, and universe tags).

---

## 💻 Local Setup & Installation

### 1. Clone the repository
```bash
git clone [https://github.com/your-username/anime-arbiter.git](https://github.com/your-username/anime-arbiter.git)
cd anime-arbiter
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env.local` file in the root of your Next.js project and add your API keys. *(Note: Upstash keys must be in `.env.local` to properly bypass Next.js caching during local development).*

```env
# Google Gemini API
GEMINI_API_KEY="your_gemini_api_key"

# Pinecone Vector Database
PINECONE_API_KEY="your_pinecone_api_key"
PINECONE_INDEX_NAME="your_index_name"

# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_REST_URL="your_upstash_url"
UPSTASH_REDIS_REST_TOKEN="your_upstash_token"
```

### 4. Run the Development Server
```bash
cd frontend
```
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) to interact with the Arbiter.
```