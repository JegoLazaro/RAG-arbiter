import { Tooltip } from "@mui/material";
import {
  React as ReactLogo,
  Typescript,
  TailwindCss,
  Github,
  Fandom,
  Upstash,
  Linkedin,
} from "@thesvg/react";
import { Computer, Copyright } from "lucide-react";
import React from "react";

const TECH_ITEMS = [
  {
    id: "vercel",
    content: (
      <>
        <img src="/vercel.svg" className="h-5 w-5 -ml-1.5" alt="Vercel logo" />{" "}
        Vercel
      </>
    ),
  },
  {
    id: "next",
    content: (
      <img
        src="/next.svg"
        className="h-6 w-14 object-contain -ml-1.5"
        alt="Next.js logo"
      />
    ),
  },
  {
    id: "react",
    content: (
      <>
        <ReactLogo className="h-5 w-5" /> React
      </>
    ),
  },
  {
    id: "typescript",
    content: (
      <>
        <Typescript className="h-5 w-5" /> TypeScript
      </>
    ),
  },
  {
    id: "tailwind",
    content: (
      <>
        <TailwindCss className="h-5 w-5" /> Tailwind CSS
      </>
    ),
  },
  {
    id: "github",
    content: (
      <>
        <Github className="h-5 w-5" /> GitHub
      </>
    ),
  },
  {
    id: "pinecone",
    content: (
      <>
        <img
          src="/pinecone-logo.png"
          className="h-7 w-7 -ml-1.5"
          alt="Pinecone logo"
        />{" "}
        Pinecone
      </>
    ),
  },
  {
    id: "gemini",
    content: (
      <>
        <img
          src="/gemini-logo.png"
          className="h-7 w-7 object-contain -ml-1.5"
          alt="Gemini logo"
        />{" "}
        Gemini
      </>
    ),
  },
  {
    id: "fandom",
    content: (
      <>
        <Fandom className="h-5 w-5" /> Fandom.wiki
      </>
    ),
  },
  {
    id: "upstash",
    content: (
      <>
        <Upstash className="h-5 w-5" /> Upstash
      </>
    ),
  },
  {
    id: "langchain",
    content: (
      <>
        <img
          src="/langchain-logo.webp"
          className="h-7 w-7 object-contain -ml-1.5"
          alt="Langchain logo"
        />{" "}
        Langchain
      </>
    ),
  },
  {
    id: "jest",
    content: (
      <>
        <img
          src="/jest-logo.webp"
          className="h-7 w-7 object-contain -ml-1.5"
          alt="Jest logo"
        />{" "}
        Jest
      </>
    ),
  },
];

const Footer = () => {
  return (
    <footer className="w-screen bg-gray-700/50 p-4 text-gray-500 text-xs font-mono overflow-hidden">
      <h2 className="text-center font-mono uppercase mb-2 text-sm font-semibold text-gray-400">
        Built using
      </h2>

      <div className="flex w-full group py-2">
        <style>
          {`
          @keyframes marquee {
            0% { transform: translateX(0%); }
            100% { transform: translateX(-100%); }
          }
          .animate-marquee {
            animation: marquee 45s linear infinite;
          }
          /* This guarantees the animation stops when the parent group is hovered */
          .group:hover .animate-marquee {
            animation-play-state: paused !important;
          }
        `}
        </style>

        <div className="flex shrink-0 animate-marquee group-hover:[animation-play-state:paused] justify-around min-w-full gap-10 pr-10 items-center">
          {TECH_ITEMS.map((item) => (
            <span
              key={item.id}
              className="flex items-center gap-1 cursor-pointer transition-all duration-200 ease-out hover:scale-[1.3] hover:z-10 hover:text-gray-100 group-hover:opacity-30 hover:opacity-100! hover:drop-shadow-md origin-center"
            >
              {item.content}
            </span>
          ))}
        </div>

        <div
          className="flex shrink-0 animate-marquee group-hover:[animation-play-state:paused] justify-around min-w-full gap-10 pr-10 items-center"
          aria-hidden="true"
        >
          {TECH_ITEMS.map((item) => (
            <span
              key={`${item.id}-duplicate`}
              className="flex items-center gap-1 cursor-pointer transition-all duration-200 ease-out hover:scale-[1.3] hover:z-10 hover:text-gray-100 group-hover:opacity-30 hover:!opacity-100 hover:drop-shadow-md origin-center"
            >
              {item.content}
            </span>
          ))}
        </div>
      </div>
      <div className="flex justify-between mx-5 px-10 my-3 items-center text-center text-xs text-gray-400">
        <span className="mr-2 flex items-center gap-1">
          <Copyright className="w-3 h-3" /> {new Date().getFullYear()} Jego
          Lazaro
        </span>
        <div className="flex flex-row items-center gap-2 justify-center">
          <Tooltip title="Jego Lazaro Portfolio Website" placement="top">
            <span className="flex cursor-pointer justify-center items-center gap-1">
              <a
                href="https://jegolazaro.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                <img
                  src="/logo_name.png"
                  className="h-5 w-fit object-contain"
                  alt="Jego Lazaro Portfolio logo"
                />{" "}
              </a>
            </span>
          </Tooltip>
          <span>
            <Tooltip title="Jego Lazaro LinkedIn Profile" placement="top">
            <a
              href="https://www.linkedin.com/in/jose-gabriel-lazaro-b842a8277/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              <Linkedin className="w-3 h-3" />
            </a>
            </Tooltip>
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
