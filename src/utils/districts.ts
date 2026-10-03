export const provinces = [
  'Province 1 (Koshi)',
  'Province 2 (Madhesh)',
  'Province 3 (Bagmati)',
  'Province 4 (Gandaki)',
  'Province 5 (Lumbini)',
  'Province 6 (Karnali)',
  'Province 7 (Sudurpashchim)'
];

export const districtsByProvince: Record<string, string[]> = {
  'Province 1 (Koshi)': [
    'Bhojpur', 'Dhankuta', 'Ilam', 'Jhapa', 'Khotang', 'Morang',
    'Okhaldhunga', 'Panchthar', 'Sankhuwasabha', 'Solukhumbu',
    'Sunsari', 'Taplejung', 'Tehrathum', 'Udayapur'
  ],
  'Province 2 (Madhesh)': [
    'Saptari', 'Siraha', 'Dhanusha', 'Mahottari', 'Sarlahi',
    'Rautahat', 'Bara', 'Parsa'
  ],
  'Province 3 (Bagmati)': [
    'Bhaktapur', 'Chitwan', 'Dhading', 'Dolakha', 'Kathmandu',
    'Kavrepalanchok', 'Lalitpur', 'Makwanpur', 'Nuwakot',
    'Ramechhap', 'Rasuwa', 'Sindhuli', 'Sindhupalchok'
  ],
  'Province 4 (Gandaki)': [
    'Baglung', 'Gorkha', 'Kaski', 'Lamjung', 'Manang', 'Mustang',
    'Myagdi', 'Nawalpur', 'Parbat', 'Syangja', 'Tanahun'
  ],
  'Province 5 (Lumbini)': [
    'Arghakhanchi', 'Banke', 'Bardiya', 'Dang', 'Eastern Rukum',
    'Gulmi', 'Kapilvastu', 'Nawalparasi West (Parasi)', 'Palpa',
    'Pyuthan', 'Rolpa', 'Rupandehi'
  ],
  'Province 6 (Karnali)': [
    'Dailekh', 'Dolpa', 'Humla', 'Jajarkot', 'Jumla', 'Kalikot',
    'Mugu', 'Salyan', 'Surkhet', 'Western Rukum'
  ],
  'Province 7 (Sudurpashchim)': [
    'Achham', 'Baitadi', 'Bajhang', 'Bajura', 'Dadeldhura',
    'Darchula', 'Doti', 'Kailali', 'Kanchanpur'
  ]
};

