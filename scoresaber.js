const axios = require("axios");

const apiurl = 'https://new.scoresaber.com/api/';

async function getPlayer(playerid) {
    let url = `${apiurl}player/${playerid}/full`;
    console.log(url);
    let response = await axios.get(url)

    return response.data;
}

module.exports = {
    getPlayer
}