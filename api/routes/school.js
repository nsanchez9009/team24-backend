const express = require('express');
const axios = require('axios');
const router = express.Router();

const COLLEGE_SCORECARD_API_KEY = process.env.COLLEGE_SCORECARD_API_KEY;
const COLLEGE_SCORECARD_BASE_URL = 'https://api.data.gov/ed/collegescorecard/v1/schools';

router.get('/search', async (req, res) => {
  const { name } = req.query;

  // Check if the name parameter is provided
  if (!name) {
    return res.status(400).json({ message: 'School name is required' });
  }

  try {
    const response = await axios.get(COLLEGE_SCORECARD_BASE_URL, {
      params: {
        'school.name': name, // Search by school name
        api_key: COLLEGE_SCORECARD_API_KEY,
        fields: 'id,school.name,school.city,school.state', // Fields to return
      },
    });

    const schools = response.data.results;
    res.json(schools);
  } catch (error) {
    console.error('Error fetching schools:', error);
    res.status(500).json({ message: 'Error fetching schools' });
  }
});

module.exports = router;
