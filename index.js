const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config({ override: true });

const CLIENT_ID = (process.env.SPOTIFY_CLIENT_ID || '').trim();
const CLIENT_SECRET = (process.env.SPOTIFY_CLIENT_SECRET || '').trim();
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;

const app = express();
app.use(cors());
app.use(express.json());

let spotifyToken = '';
let tokenExpiry = 0;

const getSpotifyToken = async () => {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');
    }
    if (Date.now() < tokenExpiry && spotifyToken) {
        return spotifyToken;
    }

    const body = new URLSearchParams({ grant_type: 'client_credentials' }).toString();
    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', body, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
            },
        });

        spotifyToken = response.data.access_token;
        tokenExpiry = Date.now() + (response.data.expires_in * 1000);
        return spotifyToken;
    } catch (error) {
        const status = error.response?.status;
        const data = error.response?.data;
        console.error('Spotify token error:', status, data || error.message);
        throw new Error(data?.error_description || data?.error || 'Failed to obtain Spotify token');
    }
};

app.get('/api/search', async (req, res) => {
    try {
        const { query, type } = req.query;

        if (!query || !type) {
            return res.status(400).json({ error: 'Query and type are required' });
        }

        const token = await getSpotifyToken();

        const response = await axios.get(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=1`,
            {
                headers: {'Authorization': `Bearer ${token}` }
            }
        );

        res.json(response.data);
    }  catch (error) {
        const status = error.response?.status || 500;
        const payload = error.response?.data || { error: error.message };
        console.error('Search error:', status, payload);
        res.status(status).json(payload);
    }
});


app.get('/api/lastfm', async (req, res) => {
    try {
        const { method, user, limit = 1, page = 1, period } = req.query;
        if (!method || !user) {
            return res.status(400).json({ error: 'method and user are required' });
        }

        const url = new URL('https://ws.audioscrobbler.com/2.0/');
        url.searchParams.set('method', method);
        url.searchParams.set('user', user);
        url.searchParams.set('api_key', LASTFM_API_KEY || '');
        url.searchParams.set('format', 'json');
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('page', String(page));
        if (period) url.searchParams.set('period', period);

        const response = await axios.get(url.toString());
        res.json(response.data);
    } catch (error) {
        console.error('Last.fm error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch from Last.fm' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});