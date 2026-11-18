import axios from 'axios';

const listDocuments = async (accessToken: string) => {
  const result = await axios({
    method: 'GET',
    url: 'http://localhost:3000/documents',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return result.data;
};

const createDocument = async (
  accessToken: string,
  name: string,
  description: string,
) => {
  const result = await axios({
    method: 'POST',
    url: 'http://localhost:3000/documents',
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { name, description },
  });

  return result.data;
};

export { listDocuments, createDocument };
