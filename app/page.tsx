'use client';

import { useState, useEffect, useRef } from 'react';
import { getDomains, createAccount, getToken, getMessages, getMessage } from '../lib/api';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';

interface Message {
  id: string;
  from: { address: string };
  createdAt: string;
  subject: string;
  intro: string;
}

interface MessageDetail extends Message {
  text: string;
  html?: string[];
}

const EMAIL_KEY = 'antigravity_mail_address';
const PASSWORD_KEY = 'antigravity_mail_password';
const TOKEN_KEY = 'antigravity_mail_token';
const EXPIRES_AT_KEY = 'antigravity_mail_expires_at';
const READ_MESSAGES_KEY = 'antigravity_mail_read_messages';

const TIMER_DURATION = 600; // 10 minutes in seconds

export default function Home() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [readMessages, setReadMessages] = useState<string[]>([]);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null);
  const [timerText, setTimerText] = useState('10:00');
  const [progress, setProgress] = useState(100);
  const [isOpened, setIsOpened] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState(0);
  const [isCopied, setIsCopied] = useState(false);

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialization
  useEffect(() => {
    const storedEmail = localStorage.getItem(EMAIL_KEY);
    const storedPassword = localStorage.getItem(PASSWORD_KEY);
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedExpiresAt = parseInt(localStorage.getItem(EXPIRES_AT_KEY) || '0') || 0;
    const storedRead = JSON.parse(localStorage.getItem(READ_MESSAGES_KEY) || '[]');

    setReadMessages(storedRead);

    const now = Math.floor(Date.now() / 1000);
    if (!storedEmail || now >= storedExpiresAt) {
      createNewEmail();
    } else {
      setEmail(storedEmail);
      setPassword(storedPassword || '');
      setToken(storedToken || '');
      setExpiresAt(storedExpiresAt);
      startTimer(storedExpiresAt);
      startPolling(storedToken || '');
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  // Tooltips
  useEffect(() => {
    const timer = setTimeout(() => {
      const instances = tippy('[data-tippy-content]', {
        theme: 'antigravity',
        animation: 'shift-away',
      });
      return () => {
        instances.forEach(instance => instance.destroy());
      };
    }, 100);
    return () => clearTimeout(timer);
  }, [email, messages, selectedMessage]);

  async function createNewEmail() {
    setIsLoading(true);
    setIsOpened(false);
    setMessages([]);
    setSelectedMessage(null);
    setActiveMessageId(null);

    try {
      const domains = await getDomains();
      if (!domains || domains.length === 0) throw new Error('No domains available');

      const domain = domains[0].domain;
      const username = Math.random().toString(36).substring(2, 12);
      const pass = Math.random().toString(36).substring(2, 14);
      const addr = `${username}@${domain}`;

      await createAccount(addr, pass);
      const tok = await getToken(addr, pass);
      const exp = Math.floor(Date.now() / 1000) + TIMER_DURATION;

      setEmail(addr);
      setPassword(pass);
      setToken(tok);
      setExpiresAt(exp);

      localStorage.setItem(EMAIL_KEY, addr);
      localStorage.setItem(PASSWORD_KEY, pass);
      localStorage.setItem(TOKEN_KEY, tok);
      localStorage.setItem(EXPIRES_AT_KEY, exp.toString());
      localStorage.setItem(READ_MESSAGES_KEY, '[]');
      setReadMessages([]);

      startTimer(exp);
      startPolling(tok);
    } catch (error) {
      console.error('Failed to create email:', error);
    }
  }

  function startTimer(targetTime: number) {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = targetTime - now;

      if (remaining <= 0) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        createNewEmail();
        return;
      }

      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      setTimerText(`${mins}:${secs.toString().padStart(2, '0')}`);
      setProgress((remaining / TIMER_DURATION) * 100);
    };
    update();
    timerIntervalRef.current = setInterval(update, 1000);
  }

  function startPolling(tok: string) {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    const poll = async () => {
      if (!tok) return;
      try {
        const fetchedMessages = await getMessages(tok);
        setMessages(fetchedMessages);
        setIsLoading(fetchedMessages.length === 0);
      } catch (error) {
        console.error('Polling error:', error);
      }
    };
    poll();
    pollingIntervalRef.current = setInterval(poll, 5000);
  }

  async function openMessage(id: string) {
    setActiveMessageId(id);
    if (!readMessages.includes(id)) {
      const newRead = [...readMessages, id];
      setReadMessages(newRead);
      localStorage.setItem(READ_MESSAGES_KEY, JSON.stringify(newRead));
    }

    try {
      const msg = await getMessage(token, id);
      setSelectedMessage(msg);
      setIsOpened(true);
    } catch (error) {
      console.error('Failed to load message:', error);
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(email).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleDelete = () => {
    localStorage.clear();
    window.location.reload();
  };

  return (
    <main>
      <div className="intro">
        <h1>Free Temporary Email</h1>
        <p>Receive emails anonymously with our free, private, and secure temporary email address generator.</p>
      </div>

      <div className="main">
        <div className="mail_input">
          <p id="email-address">{isCopied ? 'Copied!' : email || 'Generating...'}</p>
          <button id="copy-btn" onClick={handleCopy} className="copy_btn" data-tippy-content="Copy Email Address">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.81256 18.9583C9.2653 18.9583 8.80208 18.7688 8.42292 18.3896C8.04375 18.0104 7.85417 17.5472 7.85417 16.9999V4.66674C7.85417 4.11948 8.04375 3.65626 8.42292 3.27709C8.80208 2.89793 9.2653 2.70834 9.81256 2.70834H18.8958C19.443 2.70834 19.9062 2.89793 20.2854 3.27709C20.6646 3.65626 20.8542 4.11948 20.8542 4.66674V16.9999C20.8542 17.5472 20.6646 18.0104 20.2854 18.3896C19.9062 18.7688 19.443 18.9583 18.8958 18.9583H9.81256ZM9.81256 17.3333H18.8958C18.9792 17.3333 19.0556 17.2986 19.1249 17.2291C19.1944 17.1597 19.2292 17.0834 19.2292 16.9999V4.66674C19.2292 4.58332 19.1944 4.50695 19.1249 4.43761C19.0556 4.3681 18.9792 4.33334 18.8958 4.33334H9.81256C9.72915 4.33334 9.65277 4.3681 9.58344 4.43761C9.51392 4.50695 9.47917 4.58332 9.47917 4.66674V16.9999C9.47917 17.0834 9.51392 17.1597 9.58344 17.2291C9.65277 17.2986 9.72915 17.3333 9.81256 17.3333ZM6.0209 22.75C5.47363 22.75 5.01042 22.5604 4.63125 22.1813C4.25208 21.8021 4.0625 21.3389 4.0625 20.7916V6.83341H5.6875V20.7916C5.6875 20.875 5.72226 20.9514 5.79177 21.0207C5.8611 21.0903 5.93748 21.125 6.0209 21.125H16.7291V22.75H6.0209Z" fill="#1F1F1F" />
            </svg>
          </button>
        </div>

        <div className="toolbar">
          <button id="new-btn" onClick={createNewEmail} className="new" data-tippy-content="Generate New Email">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14.0449 22.75C11.6021 22.75 9.53313 21.9025 7.83796 20.2075C6.1426 18.5126 5.29492 16.444 5.29492 14.0017C5.29492 11.5595 6.1426 9.49035 7.83796 7.79421C9.53313 6.09807 11.6021 5.25 14.0449 5.25C15.4089 5.25 16.6998 5.55324 17.9174 6.15971C19.1348 6.76638 20.1474 7.62232 20.9551 8.72754V5.25H22.7051V12.3845H15.5706V10.6347H20.179C19.5641 9.50833 18.7115 8.62099 17.621 7.97271C16.5308 7.32424 15.3388 7 14.0449 7C12.1005 7 10.4477 7.68056 9.08659 9.04167C7.72548 10.4028 7.04492 12.0556 7.04492 14C7.04492 15.9444 7.72548 17.5972 9.08659 18.9583C10.4477 20.3194 12.1005 21 14.0449 21C15.5421 21 16.8935 20.5722 18.0991 19.7167C19.3046 18.8611 20.1505 17.7333 20.6366 16.3333H22.4808C21.9513 18.2373 20.9084 19.7828 19.3521 20.9697C17.7958 22.1566 16.0267 22.75 14.0449 22.75Z" fill="black" />
            </svg>
          </button>

          <button id="delete-btn" onClick={handleDelete} className="delete" data-tippy-content="Delete Current Session">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8.52571 23.9167C7.94393 23.9167 7.44693 23.7106 7.03471 23.2986C6.62268 22.8864 6.41667 22.3894 6.41667 21.8076V7H5.25V5.25H10.5V4.21808H17.5V5.25H22.75V7H21.5833V21.8076C21.5833 22.397 21.3792 22.8958 20.9708 23.3042C20.5625 23.7125 20.0637 23.9167 19.4743 23.9167H8.52571ZM19.8333 7H8.16667V21.8076C8.16667 21.9124 8.20031 21.9985 8.26758 22.0657C8.33486 22.133 8.4209 22.1667 8.52571 22.1667H19.4743C19.5641 22.1667 19.6464 22.1292 19.721 22.0544C19.7959 21.9797 19.8333 21.8975 19.8333 21.8076V7ZM10.9713 19.8333H12.721V9.33333H10.9713V19.8333ZM15.279 19.8333H17.0287V9.33333H15.279V19.8333Z" fill="black" />
            </svg>
          </button>

          <div className="progress">
            <div className="progress_bar">
              <div id="progress-bar" className="filled" style={{ width: `${progress}%` }}></div>
            </div>
            <p className='timer' id="timer">{timerText}</p>
          </div>

          <button className="refresh_time" onClick={() => startTimer(expiresAt)} data-tippy-content="Refresh Timer">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5.04833 22.9518V21.2018H8.4585L7.61033 20.3898C6.65172 19.5028 5.97009 18.5099 5.56545 17.4113C5.16082 16.3127 4.9585 15.2025 4.9585 14.0808C4.9585 12.0646 5.54893 10.2566 6.72979 8.65695C7.91065 7.05725 9.45911 5.95903 11.3752 5.36228V7.20649C9.96758 7.75677 8.83795 8.65831 7.98629 9.91111C7.13443 11.1637 6.7085 12.5536 6.7085 14.0808C6.7085 14.9931 6.88126 15.8793 7.22679 16.7393C7.57232 17.5994 8.11005 18.3943 8.84 19.1243L9.58025 19.8648V16.6699H11.3302V22.9518H5.04833ZM16.6252 22.6377V20.7935C18.0327 20.2432 19.1624 19.3417 20.014 18.0889C20.8659 16.8363 21.2918 15.4464 21.2918 13.9192C21.2918 13.0069 21.1191 12.1207 20.7735 11.2607C20.428 10.4006 19.8903 9.60564 19.1603 8.8757L18.4201 8.13516V11.3301H16.6701V5.04816H22.952V6.79816H19.5418L20.39 7.61016C21.3128 8.53318 21.9855 9.53496 22.408 10.6155C22.8306 11.6962 23.0418 12.7974 23.0418 13.9192C23.0418 15.9354 22.4514 17.7433 21.2705 19.343C20.0897 20.9427 18.5412 22.0409 16.6252 22.6377Z" fill="black" />
            </svg>
          </button>

          <button className="more" data-tippy-content="More Options">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.26953 15.75C6.78828 15.75 6.37635 15.5786 6.03374 15.2358C5.69093 14.8932 5.51953 14.4813 5.51953 14C5.51953 13.5187 5.69093 13.1068 6.03374 12.7642C6.37635 12.4214 6.78828 12.25 7.26953 12.25C7.75078 12.25 8.16281 12.4214 8.50561 12.7642C8.84823 13.1068 9.01953 13.5187 9.01953 14C9.01953 14.4813 8.84823 14.8932 8.50561 15.2358C8.16281 15.5786 7.75078 15.75 7.26953 15.75ZM14.0003 15.75C13.5191 15.75 13.1071 15.5786 12.7645 15.2358C12.4217 14.8932 12.2503 14.4813 12.2503 14C12.2503 13.5187 12.4217 13.1068 12.7645 12.7642C13.1071 12.4214 13.5191 12.25 14.0003 12.25C14.4816 12.25 14.8935 12.4214 15.2361 12.7642C15.5789 13.1068 15.7503 13.5187 15.7503 14C15.7503 14.4813 15.5789 14.8932 15.2361 15.2358C14.8935 15.5786 14.4816 15.75 14.0003 15.75ZM20.7311 15.75C20.2499 15.75 19.8378 15.5786 19.495 15.2358C19.1524 14.8932 18.9811 14.4813 18.9811 14C18.9811 13.5187 19.1524 13.1068 19.495 12.7642C19.8378 12.4214 20.2499 12.25 20.7311 12.25C21.2124 12.25 21.6243 12.4214 21.9669 12.7642C22.3097 13.1068 22.4811 13.5187 22.4811 14C22.4811 14.4813 22.3097 14.8932 21.9669 15.2358C21.6243 15.5786 21.2124 15.75 20.7311 15.75Z" fill="black" />
            </svg>
          </button>
        </div>
      </div>

      <div className="inbox">
        <div className="header">
          <p>Messages</p>
          <div className="status">
            <div className="indicator"></div>
            <p>Active status</p>
          </div>
        </div>

        <div id="inbox-container" className={`inbox_body ${isLoading ? 'loading' : ''} ${isOpened ? 'opened' : ''}`}>
          <div className="loading_content">
            <div className="spinner">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_11_870)">
                  <path d="M48 24C48 37.2548 37.2548 48 24 48C10.7452 48 0 37.2548 0 24C0 10.7452 10.7452 0 24 0C37.2548 0 48 10.7452 48 24ZM3.99348 24C3.99348 35.0493 12.9507 44.0065 24 44.0065C35.0493 44.0065 44.0065 35.0493 44.0065 24C44.0065 12.9507 35.0493 3.99348 24 3.99348C12.9507 3.99348 3.99348 12.9507 3.99348 24Z" fill="black" fillOpacity="0.15" />
                  <path d="M40.9986 39.4934C41.4068 39.8655 42.0411 39.8374 42.3959 39.4141C46.254 34.8099 48.2534 28.914 47.9743 22.8894C47.6797 16.531 44.8714 10.5501 40.1671 6.26229C35.4627 1.97452 29.2478 -0.268842 22.8894 0.0257109C16.8647 0.304804 11.1789 2.84074 6.95123 7.10798C6.56253 7.50031 6.59319 8.13453 7.00137 8.50657L8.47469 9.84943C8.88286 10.2215 9.51363 10.1902 9.90558 9.80108C13.4173 6.31495 18.1076 4.24499 23.0742 4.01491C28.3746 3.76937 33.5554 5.63945 37.4769 9.21376C41.3985 12.7881 43.7395 17.7738 43.9851 23.0742C44.2152 28.0408 42.5877 32.9024 39.4412 36.7213C39.09 37.1476 39.1171 37.7785 39.5253 38.1506L40.9986 39.4934Z" fill="#0066FF" />
                </g>
                <defs>
                  <clipPath id="clip0_11_870">
                    <rect width="48" height="48" rx="24" fill="white" />
                  </clipPath>
                </defs>
              </svg>
            </div>
            <p className="title">Listening for incoming mail...</p>
            <p className="sub_text">Messages will appear here as soon as they are sent</p>
          </div>

          <div id="email-list" className="list">
            {messages.map((msg) => {
              const isRead = readMessages.includes(msg.id);
              const isActive = msg.id === activeMessageId;
              return (
                <div key={msg.id} className={`item ${isActive ? 'active' : ''}`} onClick={() => openMessage(msg.id)}>
                  <div className="head">
                    <p className="mail_text">{msg.from.address}</p>
                    <p className="time">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="title">
                    <p>{msg.subject || '(No Subject)'}</p>
                    {!isRead && <div className="indicator"></div>}
                  </div>
                  <p className="body_text">{msg.intro || ''}</p>
                </div>
              );
            })}
          </div>

          <div id="single-mail-view" className="single_mail">
            {selectedMessage && (
              <>
                <div className="header">
                  <button id="back-to-list" className='back_button' onClick={(e) => { e.stopPropagation(); setIsOpened(false); }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11.0533 12L15.6533 7.4L14.5996 6.34625L8.94582 12L14.5996 17.6538L15.6533 16.6L11.0533 12Z" fill="#1F1F1F" />
                    </svg>

                  </button>
                  <div className="texts">
                    <h2>{selectedMessage.subject || '(No Subject)'}</h2>
                    <p>From: {selectedMessage.from.address}</p>
                  </div>
                </div>
                <div className="content-body">
                  {selectedMessage.html ? (
                    <iframe
                      id="mail-frame"
                      srcDoc={selectedMessage.html[0]}
                      style={{ width: '100%', border: 'none', minHeight: '400px' }}
                      onLoad={(e) => {
                        const frame = e.target as HTMLIFrameElement;
                        if (frame.contentWindow) {
                          frame.style.height = frame.contentWindow.document.body.scrollHeight + 'px';
                        }
                      }}
                    />
                  ) : (
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{selectedMessage.text}</pre>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
