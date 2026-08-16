module.exports = {
  content: ['../index.html', '../assets/js/*.js'],
  theme: {
    extend: {
      colors: {
        rose: { 50:'#FDF7F8',100:'#F9EBEF',200:'#F1D6DD',300:'#E7B8C3',
                400:'#DE9CAB',500:'#D88898',600:'#C06D80',700:'#A0566A' },
        ink:  { 400:'#867179',500:'#6B545B',600:'#453238',
                700:'#2A1D22',800:'#1F1519',900:'#140E10' },
        sand: { 50:'#FBF8F8',100:'#F4EFF0' },
      },
      fontFamily: {
        display: ['Playfair Display','Georgia','serif'],
        sans: ['Inter','system-ui','sans-serif'],
      },
    },
  },
};
