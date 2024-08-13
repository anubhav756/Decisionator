'use client';

import { useState } from 'react';

const INITIAL_INPUT = '';
const INITIAL_OPTIONS = [];
const INITIAL_RESPONSE = {};
const INITIAL_IS_SUBMITTING = false;
const INITIAL_IS_EXPANDED = false;

export default function Page() {
  const [inputText, setInputText] = useState(INITIAL_INPUT);
  const [options, setOptions] = useState(INITIAL_OPTIONS);
  const [response, setResponse] = useState(INITIAL_RESPONSE);
  const [isSubmitting, setIsSubmitting] = useState(INITIAL_IS_SUBMITTING);
  const [isExpanded, setIsExpanded] = useState(INITIAL_IS_EXPANDED);

  const handleInputChange = (event) => {
    setInputText(event.target.value);
  };
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleSnap();
    }
  };
  const handleSnap = async () => {
    setResponse(INITIAL_RESPONSE);
    setOptions(INITIAL_OPTIONS);
    setIsExpanded(INITIAL_IS_EXPANDED);
    setIsSubmitting(true);
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
    finally {
      setIsSubmitting(INITIAL_IS_SUBMITTING);
    }
  };
  const IsVisible = (option_str) => {
    if (!response.options) return true;

    for (const {title, is_chosen} of response.options) {
      if (title == option_str && is_chosen) return true;
    }

    return false;
  }

  return (
    <div className="max-h-[80vh] overflow-y-auto">
      <div className="fixed bottom-0 left-0 w-full flex justify-center p-4">
        <input
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type here to decide..."
          className="w-3/4 p-8 rounded-full outline-none bg-gray-900 text-white text-5xl resize-none"
        />
        <div className="relative inline-flex group ml-8">
          <div className={`absolute transitiona-all duration-1000 bg-gradient-to-r from-[#44BCFF] via-[#FF44EC] to-[#FF675E] rounded-full blur-lg group-hover:opacity-100 group-hover:-inset-1 group-hover:duration-200 animate-tilt ${isSubmitting ? "opacity-100 -inset-1" : "opacity-70 -inset-px"}`} />
          <a
            onClick={(e) => {
              if (isSubmitting || !inputText.length) e.preventDefault(); 
              else handleSnap(); 
            }}
            className={`relative inline-flex items-center justify-center px-8 py-4 text-5xl text-white transition-all duration-200 font-pj rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 focus:outline-none
                      ${isSubmitting ? 'pointer-events-none opacity-50 backdrop-filter backdrop-blur-lg' : 'bg-gray-900'}`}
            role="button"
          >
            Snap
          </a>
        </div>
      </div>
      <div>
      <div className="flex justify-center text-4xl mt-16"> 
        <div className="grid grid-cols-2 flex space-y-20"> 
          {options.map((str, index) => (
            <div key={index} className={`flex p-4 rounded-lg shadow-md text-white transition-opacity duration-1000 ease-in-out ${IsVisible(str) ? 'opacity-100' : 'opacity-0'}`}>
              {str}
            </div>
          ))}
        </div>
      </div>
    </div>
    {isSubmitting && !response.response && (
      <div className="fixed inset-0 z-50"> 
        <div className="flex items-center justify-center h-screen">
          <img src="logo-sharded.png" />
          <img src="shard-1.png" className="animate-spin" style={{ position: 'absolute', marginBottom: 500, marginLeft: 150 }} />
          <img src="shard-2.png" className="animate-spin" style={{ position: 'absolute', marginBottom: 440, marginLeft: 40 }} />
          <img src="shard-3.png" className="animate-spin" style={{ position: 'absolute', marginBottom: 400, marginLeft: 220 }} />
        </div>
      </div>
    )}
    {response.response ? (
      <div className="mt-24 justify-center text-3xl">
        <div className="text-gray-400">
          **{response.character} gives a finger snap**
        </div>
        <div className="text-gray-400 mb-16">
          ...
        </div>
        <div className="text-white mt-4">
          {response.character}: {response.response}
        </div>
        <div className="mt-4 text-lg font-normal">
          {isExpanded ? (
            <div>
              <div><span className="font-bold text-gray-400">Original dialog: </span>{response.original_quote}</div>
              <div><span className="font-bold text-gray-400">Character: </span>{response.character}</div>
              <div><span className="font-bold text-gray-400">Movie: </span>{response.movie}</div>
              <div><span className="font-bold text-gray-400">Year: </span>{response.year}</div>
              <div><span className="font-bold text-gray-400">Possible choices:</span></div>
              <ul className="pl-6">
              {response && response.options && response.options.map(({title, justification, is_chosen}, i) => (
                <li key={i}>{is_chosen ? "✅" : "❌"} <b>{title} </b>{justification}</li>
              ))}
              </ul>
            </div>
          ) : (
            <button className="text-gray-400 hover:text-white font-bold" onClick={()=>setIsExpanded(!isExpanded)}>More Insights</button>
          )}
        </div>
      </div>
    ) : ""}
    </div>
  );
}
