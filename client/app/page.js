'use client';

import { useState } from 'react';
import styles from './page.module.css';

const INITIAL_INPUT = '';
const INITIAL_OPTIONS = [];
const INITIAL_RESPONSE = {};

export default function Page() {
  const [inputText, setInputText] = useState(INITIAL_INPUT);
  const [options, setOptions] = useState(INITIAL_OPTIONS);
  const [response, setResponse] = useState(INITIAL_RESPONSE);

  const handleInputChange = (event) => {
    setInputText(event.target.value);
  };

  const handleSubmit = async () => {
    setResponse(INITIAL_RESPONSE);
    setOptions(INITIAL_OPTIONS);
    try {
      const response = await fetch('http://localhost:8000/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: inputText }),
      });

      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkResponse = JSON.parse(new TextDecoder().decode(value));
        console.log(chunkResponse);

        if (chunkResponse.response) setResponse(chunkResponse)
        else setOptions(chunkResponse);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div>
      <div className="fixed bottom-0 left-0 w-full flex justify-center p-4">
        <textarea
          value={inputText}
          onChange={handleInputChange}
          placeholder="Type here to decide..."
          className="w-3/4 p-8 rounded-lg outline-none bg-gray-900 text-white text-5xl resize-none"
        />
      <div className="relative inline-flex group">
        <div className="absolute transitiona-all duration-1000 opacity-70 -inset-px bg-gradient-to-r from-[#44BCFF] via-[#FF44EC] to-[#FF675E] rounded-xl blur-lg group-hover:opacity-100 group-hover:-inset-1 group-hover:duration-200 animate-tilt" />
        <a
          onClick={handleSubmit}
          className="relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-gray-900 font-pj rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
          role="button">
          <img src="/logo.png" className="w-20" />
        </a>
      </div>
    </div>
      <div>Options:
      {
        options.map((option, i) => (
          <div key={i}>{option}</div>
        ))
      }
      </div>
      <div>
        <h3 className="text-white mt-5 text-base font-medium tracking-tight">Writes Upside-Down</h3>
        <p className="text-slate-400 mt-2 text-sm">
          The Zero Gravity Pen can be used to write in any orientation, including upside-down. It even works in outer space.
        </p>
      </div>
      <div>Response: {response.response}</div>
      <div>Original dialog: {response.original_quote}</div>
      <div>Character: {response.character}</div>
      <div>Movie: {response.movie}</div>
      <div>Year: {response.year}</div>
      <div>Justifications:</div>
      {response && response.options && response.options.map(({title, justification, is_chosen}, i) => (
        <div key={i}><b>{title}: </b>{justification}{is_chosen && " | CHOSEN!!!"}</div>
      ))}
    </div>
  );
}
