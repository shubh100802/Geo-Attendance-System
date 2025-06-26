// Browser check middleware for server-side validation
function checkBrowser(req, res, next) {
  const userAgent = req.headers['user-agent'] || '';
  
  // A more robust check for Chrome that excludes other Chromium browsers like Edge and Opera
  const isChrome = /Chrome/.test(userAgent) && !/Edg/.test(userAgent) && !/OPR/.test(userAgent);
  
  if (!isChrome) {
    return res.status(403).json({ 
      message: 'This application requires Google Chrome browser for optimal functionality and security',
      requiresChrome: true,
      detectedBrowser: getBrowserName(userAgent)
    });
  }
  
  next();
}

function getBrowserName(userAgent) {
  if (/Edg/.test(userAgent)) {
    return 'Edge';
  }
  if (/OPR/.test(userAgent) || /Opera/.test(userAgent)) {
    return 'Opera';
  }
  if (/Firefox/.test(userAgent)) {
    return 'Firefox';
  }
  if (/Chrome/.test(userAgent)) {
    return 'Chrome';
  }
  if (/Safari/.test(userAgent)) {
    return 'Safari';
  }
  return 'Unknown';
}

module.exports = { checkBrowser, getBrowserName }; 