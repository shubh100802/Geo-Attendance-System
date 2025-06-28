// Browser check middleware for server-side validation
function checkBrowser(req, res, next) {
  const userAgent = req.headers['user-agent'] || '';
  
  // Skip browser check for API requests in development or if explicitly allowed
  if (process.env.NODE_ENV === 'development' || req.path.startsWith('/api/')) {
    return next();
  }
  
  // For debugging deployment issues, temporarily allow all browsers
  // TODO: Re-enable strict browser check after fixing deployment issues
  console.log("Browser check - User agent:", userAgent);
  
  // A more robust check for Chrome that excludes other Chromium browsers like Edge and Opera
  const isChrome = /Chrome/.test(userAgent) && !/Edg/.test(userAgent) && !/OPR/.test(userAgent);
  
  // Allow Chrome and also allow requests from mobile Chrome
  const isMobileChrome = /Chrome/.test(userAgent) && /Mobile/.test(userAgent);
  
  // Temporarily allow all browsers for debugging
  if (false && !isChrome && !isMobileChrome) {
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