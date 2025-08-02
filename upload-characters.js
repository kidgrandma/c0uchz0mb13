// upload-characters.js
import { db } from './firebase-config.js';
import { collection, doc, setDoc } from 'firebase/firestore';

const characterData = {
  'andy-office': { name: 'Andy Bernard', show: 'The Office' },
  'angela-office': { name: 'Angela Martin', show: 'The Office' },
  'bart-simpson': { name: 'Bart Simpson', show: 'The Simpsons' },
  'beavis-butthead': { name: 'Beavis & Butt-Head', show: 'Beavis and Butt-Head' },
  'bender-futurama': { name: 'Bender Rodriguez', show: 'Futurama' },
  'bobby-hill': { name: 'Bobby Hill', show: 'King of the Hill' },
  'bojack-horseman': { name: 'BoJack Horseman', show: 'BoJack Horseman' },
  'butters-south-park': { name: 'Butters Stotch', show: 'South Park' },
  'captain-planet': { name: 'Captain Planet', show: 'Captain Planet' },
  'cartman-south-park': { name: 'Eric Cartman', show: 'South Park' },
  'coach-mcguirk': { name: 'Coach McGuirk', show: 'Home Movies' },
  'courage-cowardly': { name: 'Courage', show: 'Courage the Cowardly Dog' },
  'creed-office': { name: 'Creed Bratton', show: 'The Office' },
  'daria-daria': { name: 'Daria Morgendorffer', show: 'Daria' },
  'darryl-office': { name: 'Darryl Philbin', show: 'The Office' },
  'dexters-laboratory': { name: 'Dexter', show: "Dexter's Laboratory" },
  'dog-adventure-time': { name: 'Jake the Dog', show: 'Adventure Time' },
  'dora-explorer': { name: 'Dora', show: 'Dora the Explorer' },
  'dwight-office': { name: 'Dwight Schrute', show: 'The Office' },
  'ed-edd-eddy': { name: 'Ed, Edd n Eddy', show: 'Ed, Edd n Eddy' },
  'gloomy-bear': { name: 'Gloomy Bear', show: 'Gloomy Bear' },
  'homer-simpsons': { name: 'Homer Simpson', show: 'The Simpsons' },
  'invader-zim': { name: 'Zim', show: 'Invader Zim' },
  'jan-office': { name: 'Jan Levinson', show: 'The Office' },
  'jane-daria': { name: 'Jane Lane', show: 'Daria' },
  'jim-office': { name: 'Jim Halpert', show: 'The Office' },
  'kelly-office': { name: 'Kelly Kapoor', show: 'The Office' },
  'kevin-office': { name: 'Kevin Malone', show: 'The Office' },
  'lola-space-jam': { name: 'Lola Bunny', show: 'Space Jam' },
  'meredith-office': { name: 'Meredith Palmer', show: 'The Office' },
  'michael-office': { name: 'Michael Scott', show: 'The Office' },
  'moe-simpsons': { name: 'Moe Szyslak', show: 'The Simpsons' },
  'mojo-powerpuff-girls': { name: 'Mojo Jojo', show: 'The Powerpuff Girls' },
  'naruto-naruto': { name: 'Naruto Uzumaki', show: 'Naruto' },
  'pim-smiling': { name: 'Pim', show: 'Smiling Friends' },
  'powerpuff-girls': { name: 'The Powerpuff Girls', show: 'The Powerpuff Girls' },
  'princess-adventure-time': { name: 'Princess Bubblegum', show: 'Adventure Time' },
  'rick-morty': { name: 'Rick Sanchez', show: 'Rick and Morty' },
  'riley-boondocks': { name: 'Riley Freeman', show: 'The Boondocks' },
  'robert-california-office': { name: 'Robert California', show: 'The Office' },
  'robot-chicken': { name: 'Robot Chicken', show: 'Robot Chicken' },
  'rodger-american-dad': { name: 'Roger', show: 'American Dad!' },
  'ryan-office': { name: 'Ryan Howard', show: 'The Office' },
  'sailor-moon': { name: 'Usagi Tsukino', show: 'Sailor Moon' },
  'stanley-office': { name: 'Stanley Hudson', show: 'The Office' },
  'stewie-family-guy': { name: 'Stewie Griffin', show: 'Family Guy' },
  'tina-bobs-burgers': { name: 'Tina Belcher', show: "Bob's Burgers" },
  'trent-daria': { name: 'Trent Lane', show: 'Daria' }
};

async function uploadCharacters() {
  console.log('Starting character upload...');
  let successCount = 0;
  
  for (const [id, data] of Object.entries(characterData)) {
    try {
      await setDoc(doc(db, 'characters', id), {
        ...data,
        available: true,
        ownerId: '',
        individualPoints: 0,
        teamPoints: 0
      });
      successCount++;
      console.log(`✓ Uploaded: ${data.name}`);
    } catch (error) {
      console.error(`✗ Error uploading ${data.name}:`, error);
    }
  }
  
  console.log(`\nUpload complete! ${successCount}/${Object.keys(characterData).length} characters uploaded successfully.`);
}

// Run the upload
uploadCharacters();