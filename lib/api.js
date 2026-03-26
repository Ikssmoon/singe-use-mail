const BASE_URL = 'https://api.mail.tm';

export async function getDomains() {
  const response = await fetch(`${BASE_URL}/domains`);
  const data = await response.json();
  return data['hydra:member'];
}

export async function createAccount(address, password) {
  const response = await fetch(`${BASE_URL}/accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ address, password }),
  });
  return await response.json();
}

export async function getToken(address, password) {
  const response = await fetch(`${BASE_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ address, password }),
  });
  const data = await response.json();
  return data.token;
}

export async function getMessages(token) {
  const response = await fetch(`${BASE_URL}/messages`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  return data['hydra:member'];
}

export async function getMessage(token, id) {
  const response = await fetch(`${BASE_URL}/messages/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return await response.json();
}
