'use client';

import { useState } from 'react';

const INITIAL_INPUT = '';
const INITIAL_OPTIONS = [];
const INITIAL_RESPONSE = {};
const INITIAL_IS_SUBMITTING = false;
const INITIAL_IS_OPEN = false;

export default function Page() {
  const [inputText, setInputText] = useState(INITIAL_INPUT);
  const [options, setOptions] = useState(INITIAL_OPTIONS);
  const [response, setResponse] = useState(INITIAL_RESPONSE);
  const [isSubmitting, setIsSubmitting] = useState(INITIAL_IS_SUBMITTING);
  const [isOpen, setIsOpen] = useState(INITIAL_IS_OPEN);

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

  return (
    <div>
      <div className="fixed bottom-0 left-0 w-full flex justify-center p-4">
        <input
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type here to decide..."
          className="w-3/4 p-8 rounded-lg outline-none bg-gray-900 text-white text-5xl resize-none"
        />
    <div className="relative inline-flex group ml-8">
      <div className={`absolute transitiona-all duration-1000 bg-gradient-to-r from-[#44BCFF] via-[#FF44EC] to-[#FF675E] rounded-xl blur-lg group-hover:opacity-100 group-hover:-inset-1 group-hover:duration-200 animate-tilt ${isSubmitting ? "opacity-100 -inset-1" : "opacity-70 -inset-px"}`} />
      <a
        onClick={(e) => {
          if (isSubmitting || !inputText.length) {
            e.preventDefault(); 
          } else {
            handleSnap(); 
          }
        }}
        className={`relative inline-flex items-center justify-center px-8 py-4 text-5xl text-white transition-all duration-200 bg-gray-900 font-pj rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 focus:outline-none
                   ${isSubmitting ? 'pointer-events-none opacity-50' : ''}`}
        role="button">
        Snap
      </a>
    </div>
    </div>
    <div>
      <div className="flex justify-center items-center text-4xl mt-24"> 
        <div className="grid grid-cols-2 gap-4"> 
          {options.map((str, index) => (
            <div key={index} className="flex p-4 rounded-lg shadow-md text-white"> 
              {str}
            </div>
          ))}
        </div>
      </div>
    </div>
    {response.response ? (
      <div className="mt-24 justify-center text-3xl transition-all duration-200">
        <div className="text-gray-400">
          **{response.character} snaps finger**
        </div>
        <div className="text-white mt-4">
          {response.response}
        </div>
        <button 
          onClick={() => setIsOpen(true)}
          className="mt-24 bg-gray-800 hover:bg-gray-700 text-xl text-white py-2 px-4 rounded"
        >
          More Insights
        </button>
      </div>
    ) : ""}
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-white"> {/* Dark background and white text */}
          <button onClick={() => setIsOpen(false)} className="absolute top-2 right-2 text-gray-300 hover:text-gray-100">
            Close
          </button>
          <div>Original dialog: {response.original_quote}</div>
          <div>Character: {response.character}</div>
          <div>Movie: {response.movie}</div>
          <div>Year: {response.year}</div>
          <div>Justifications:</div>
          {response && response.options && response.options.map(({title, justification, is_chosen}, i) => (
            <div key={i}><b>{title}: </b>{justification}{is_chosen && " | CHOSEN!!!"}</div>
          ))}
        </div>
      </div>
    )}
    </div>
  );
}
