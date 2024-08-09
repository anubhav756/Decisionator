'use client';

import { useState } from 'react';
import styles from './page.module.css';

export default function Page() {
  const [inputText, setInputText] = useState('');
  const [streamedResponse, setStreamedResponse] = useState('');

  const handleInputChange = (event) => {
    setInputText(event.target.value);
  };

  const handleSubmit = async () => {
    setStreamedResponse('');

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
        if (done) {
          break;
        }

        const chunkText = new TextDecoder().decode(value);
        setStreamedResponse((prev) => prev + chunkText);
      }
    } catch (error) {
      console.error('Error:', error);
      setStreamedResponse('An error occurred. Please try again.');
    }
  };

  return (
    <div className={styles.container}>
      <textarea
        value={inputText}
        onChange={handleInputChange}
        placeholder="Enter text here..."
        className={styles.textArea}
      />

      <button onClick={handleSubmit} className={styles.button}>
        <img src="/logo.png" alt="Send" className={styles.buttonImage} />
      </button>

      <div className={styles.responseContainer}>
        <pre className={styles.responsePre}>{streamedResponse}</pre> 
      </div>
    </div>
  );
}
