'use client';

import { useState } from 'react';
import styles from './page.module.css';

const INITIAL_INPUT = '';
const INITIAL_OPTIONS = [];
const INITIAL_RESPONSE = '';

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

        if (chunkResponse.response) setResponse(chunkResponse.response)
        else setOptions(chunkResponse);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className={styles.container}>
      <textarea
        value={inputText}
        onChange={handleInputChange}
        placeholder="Enter here to decide..."
        className={styles.textArea}
      />

      <button onClick={handleSubmit} className={styles.button}>
        <img src="/logo.png" alt="Send" className={styles.buttonImage} />
      </button>
      <div>Options: {JSON.stringify(options)}</div>
      <div>Response: {response}</div>
    </div>
  );
}
