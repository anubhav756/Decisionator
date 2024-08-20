'use client';

import { useState } from 'react';

const INITIAL_INPUT = '';
const INITIAL_OPTIONS = [];
const INITIAL_RESPONSE = {};
const INITIAL_IS_SUBMITTING = false;
const INITIAL_IS_EXPANDED = false;
const COLORS = (() => {
  let ALL_COLORS = ["red", "orange", "amber", "lime", "emerald", "cyan", "indigo", "fuchsia"];
  let currentIndex = ALL_COLORS.length;

  while (currentIndex != 0) {
    let randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [ALL_COLORS[currentIndex], ALL_COLORS[randomIndex]] = [
      ALL_COLORS[randomIndex], ALL_COLORS[currentIndex]];
  }

  return ALL_COLORS;
})();

const IsVisible = (option_str, all_options) => {
  if (!all_options) return true;

  for (const {title, is_chosen} of all_options) {
    if (title == option_str && is_chosen) return true;
  }

  return false;
};

const largestCommonSubstring = (str1, str2) => {
  let m = str1.length;
  let n = str2.length;

  let table = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  let maxLength = 0;
  let endIndex = -1;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1].toLowerCase() === str2[j - 1].toLowerCase() || 
          /[^a-zA-Z0-9]/.test(str1[i - 1]) && /[^a-zA-Z0-9]/.test(str2[j - 1])) {
        table[i][j] = table[i - 1][j - 1] + 1;
        if (table[i][j] > maxLength) {
          maxLength = table[i][j];
          endIndex = i - 1;
        }
      }
    }
  }

  if (maxLength <= 0) return null;

  return {
    start: endIndex - maxLength + 1,
    end: endIndex + 1,
  };
}

const Dialog = ({ response }) => {
  const dialogPos = largestCommonSubstring(response.response, response.original_quote);
  
  if (!dialogPos) return response.response;

  return (
    <span>
      {response.response.substring(0, dialogPos.start)}
      <span className="bg-gradient-to-r from-blue-500 via-teal-500 to-pink-500 bg-clip-text text-transparent">
        {response.response.substring(dialogPos.start, dialogPos.end)}
      </span>
      {response.response.substring(dialogPos.end)}
    </span>
  );
};

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
      const response = await fetch(process.env.NEXT_PUBLIC_REACT_APP_BASE_URL + '/ask', {
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
      setInputText('Oops! ' + error);
    }
    finally {
      setIsSubmitting(INITIAL_IS_SUBMITTING);
    }
  };

  return (
    <div className="h-[80vh] p-8 pt-0 overflow-y-auto">
      <div className="fixed bottom-0 left-0 w-full flex justify-center p-4">
        <input
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type choices here..."
          className="w-3/4 p-8 rounded-full outline-none bg-gray-900 text-white text-5xl resize-none placeholder-gray-600"
        />
        <div className="relative inline-flex group ml-8">
          <div className={`absolute transitiona-all duration-1000 bg-gradient-to-r from-[#44BCFF] via-[#FF44EC] to-[#FF675E] rounded-full blur-lg group-hover:opacity-100 group-hover:-inset-1 group-hover:duration-200 animate-tilt ${isSubmitting ? "opacity-100 -inset-1" : "opacity-70 -inset-px"}`} />
          <a
            onClick={(e) => {
              if (isSubmitting || !inputText.length) e.preventDefault(); 
              else handleSnap(); 
            }}
            className={`relative inline-flex items-center justify-center px-8 py-4 text-5xl text-white transition-all duration-200 font-pj rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 focus:outline-none
                      ${isSubmitting ? 'pointer-events-none opacity-100 backdrop-filter backdrop-blur-lg' : 'bg-gray-900'}`}
            role="button"
          >
            Snap
          </a>
        </div>
      </div>
      <div>
      <div className="text-4xl"> 
        <div className="grid grid-cols-2 flex content-evenly"> 
          {options.map((str, index) => (
            <div key={index} className={`flex justify-center mt-16 p-4 rounded-lg shadow-md text-white transition-opacity duration-1000 ease-in-out relative ${IsVisible(str, response.options) ? 'opacity-100' : 'opacity-0'}`}>
              <span className={`absolute mx-auto border w-fit bg-${COLORS[index % COLORS.length]}-500 blur-xl bg-clip-text box-content font-extrabold text-transparent`}>
                {str}
              </span>
              <h1
                className={`relative top-0 w-fit h-auto bg-${COLORS[index % COLORS.length]}-400 bg-clip-text font-extrabold text-transparent`}>
                  {str}
              </h1>
            </div>
          ))}
        </div>
      </div>
    </div>
    {!response.response && (
      <div className="fixed inset-0" style={{ zIndex: -1 }}>
        <div className="flex items-center justify-center h-screen">
          <img src="/logo-sharded.png" style={{ height: 250 }} />
          {isSubmitting && (
            <>
              <img src="/shard-1.png" className="animate-spin" style={{ position: 'absolute', height: 33, marginBottom: 270, marginLeft: 85 }} />
              <img src="/shard-2.png" className="animate-spin" style={{ position: 'absolute', height: 24, marginBottom: 230, marginLeft: 20 }} />
              <img src="/shard-3.png" className="animate-spin" style={{ position: 'absolute', height: 17, marginBottom: 210, marginLeft: 130 }} />
            </>
          )}
        </div>
      </div>
    )}
    {response.response ? (
      <div className="mt-16 justify-center text-3xl">
        <div>
        <span className="text-gray-400">{response.character}:</span> <span className="italic">*snaps finger*</span>
        </div>
        <div className="text-white mt-4">
          <span className="text-gray-400">{response.character}:</span> <Dialog response={response} />
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
                <li key={i}>{is_chosen ? "✅" : "❌"} <span className="font-bold">{title} </span><span className="font-normal text-gray-400">{justification}</span></li>
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
