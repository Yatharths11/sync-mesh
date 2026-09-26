import axios from 'axios';

const login = async (email: string, password: string, deviceName: string) => {
  const result = await axios({
    method: 'POST',
    url: 'http://localhost:3000/auth/login',
    data: { email, password, deviceName },
  });

  return result.data;
};

const refresh = async (deviceName: string,presentedRefreshToken: string ) => {
	const response =  await axios({
    method: 'POST',
    url: 'http://localhost:3000/auth/refresh',
    data: { deviceId: deviceName, presentedRefreshToken },
  });

	return response.data;
};

export { login, refresh };
