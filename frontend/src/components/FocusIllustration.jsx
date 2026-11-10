import './FocusIllustration.css';

function SketchPaperDefs({ id }) {
  return (
    <defs>
      <pattern id={`${id}-paper`} width="31" height="31" patternUnits="userSpaceOnUse">
        <path d="M2 5h6m12 6h4M5 23h3m16 5h5M15 2h2m-5 18h4m9-14h3" fill="none" stroke="#687276" strokeWidth=".6" opacity=".22" />
        <circle cx="14" cy="8" r=".7" fill="#58666A" opacity=".24" />
        <circle cx="27" cy="18" r=".65" fill="#58666A" opacity=".21" />
        <circle cx="9" cy="29" r=".6" fill="#58666A" opacity=".22" />
      </pattern>
      <pattern id={`${id}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
        <path d="M-2 7 7-2M1 10 10 1M-2 0 7 9M1-3 10 6" fill="none" stroke="#394B50" strokeWidth=".7" opacity=".32" />
      </pattern>
      <radialGradient id={`${id}-wash-teal`}>
        <stop stopColor="#91C9BE" stopOpacity=".56" />
        <stop offset="1" stopColor="#91C9BE" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}-wash-peach`}>
        <stop stopColor="#EFC09F" stopOpacity=".57" />
        <stop offset="1" stopColor="#EFC09F" stopOpacity="0" />
      </radialGradient>
      <filter id={`${id}-pencil`} x="-4%" y="-4%" width="108%" height="108%">
        <feTurbulence type="fractalNoise" baseFrequency=".025" numOctaves="1" seed="12" result="paper-wobble" />
        <feDisplacementMap in="SourceGraphic" in2="paper-wobble" scale="1.15" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  );
}

function Scene({ type }) {
  if (type === 'landing') {
    return (
      <svg className="focus-illustration" viewBox="0 0 700 440" role="img" aria-label="מחברת פתוחה הופכת לעולם של ספרים ורעיונות מצוירים בעיפרון">
        <SketchPaperDefs id="signature-landing" />
        <rect width="700" height="440" fill="#F6F0E4" />
        <rect width="700" height="440" fill="url(#signature-landing-paper)" />
        <ellipse cx="500" cy="122" rx="157" ry="112" fill="url(#signature-landing-wash-teal)" />
        <ellipse cx="208" cy="280" rx="128" ry="102" fill="url(#signature-landing-wash-peach)" />
        <g filter="url(#signature-landing-pencil)">
        <path d="M92 342c75-27 150-37 229-23 47 9 86 25 127 25 45 0 91-16 158-43" fill="none" stroke="#59666A" strokeWidth="1.2" opacity=".32" />
        <path d="M94 347c73-24 151-31 225-17 48 9 87 24 130 23 50-1 95-19 156-44" fill="none" stroke="#59666A" strokeWidth=".8" opacity=".28" />
        <path d="M133 306c51-19 113-20 183-5l41 82c-68-22-135-25-205-8Z" fill="#FFFDF7" stroke="#394B50" strokeWidth="2.1" strokeLinejoin="round" />
        <path d="M357 301c55-24 119-29 191-21l-10 79c-68-7-125 2-172 24Z" fill="#FFFDF7" stroke="#394B50" strokeWidth="2.1" strokeLinejoin="round" />
        <path d="M353 303c-6 28-7 53 4 79m-1-76c-5 27-4 51 3 72" fill="none" stroke="#394B50" strokeWidth="1.1" opacity=".78" />
        <path d="M149 316c47-12 93-12 141-2m-129 16c42-10 80-9 122-1m-110 18c38-6 71-5 107 3m95-31c39-13 81-19 128-17m-124 34c37-11 75-16 117-14m-115 30c35-8 69-11 104-9" fill="none" stroke="#59666A" strokeWidth=".9" strokeLinecap="round" opacity=".59" />
        <path d="M132 307c60-26 125-24 193-7l-6 10c-66-16-122-17-182 5Zm228-7c55-27 115-35 192-25l-4 10c-72-8-130 1-185 26Z" fill="url(#signature-landing-hatch)" opacity=".55" />
        <path d="M146 382c70-21 133-17 205 5m-197-1c63-18 124-14 187 6m35-8c51-22 101-30 158-27m-151 34c49-20 97-27 148-24" fill="none" stroke="#394B50" strokeWidth=".7" opacity=".48" />
        <path d="m177 263 14-50c14-5 30-3 47 5l-13 57c-16-9-32-12-48-12Z" fill="#F7F1E5" fillOpacity=".82" stroke="#394B50" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="m184 260 13-43m-5 46 12-39m-6 43 12-35m-23-8c14-3 26-1 39 5m-43 7c14-3 27-1 39 6m-43 6c13-2 24 1 36 7m-46-17 9 2m-11 7 9 2m-11 7 9 2" fill="none" stroke="#394B50" strokeWidth=".8" opacity=".8" />
        <path d="M180 268c13 0 25 3 37 10m-43-13c15 1 29 5 43 12" fill="none" stroke="#167D83" strokeWidth="1.1" opacity=".8" />
        <path d="M486 200c-2-16 8-28 24-30 15-2 27 8 28 24 1 10-5 16-11 22-4 4-6 9-6 14l-20 1c0-8-2-12-7-17-5-4-8-8-8-14Z" fill="#FFFDF7" fillOpacity=".78" stroke="#394B50" strokeWidth="1.5" />
        <path d="m502 232 19-1m-17 5 16-1m-14 5 12-1m-20-42c5-8 12-11 21-8m-19 14c5-5 11-7 17-5" fill="none" stroke="#394B50" strokeWidth=".9" strokeLinecap="round" />
        <path d="M496 246c8 2 15 1 22-2m-29-53-5-6m58 1 7-5m-34-18 1-8m-23 29-8-2" fill="none" stroke="#167D83" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M225 219c56-36 120-44 183-25 34 10 59 12 82 7" fill="none" stroke="#394B50" strokeWidth=".9" strokeDasharray="2 6" opacity=".72" />
        <path d="M262 211c21-19 41-27 65-25m-56 36c17-12 32-17 48-16m93 2c20-18 42-23 64-16m-55 27c17-9 32-12 48-8" fill="none" stroke="#394B50" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M314 216c-2-28 8-49 32-66 25 14 36 35 33 63m-62-3c18-12 41-13 64-3" fill="none" stroke="#167D83" strokeWidth="2.1" strokeLinecap="round" />
        <path d="M330 164c12-12 30-13 43-2m-39 10c11-8 23-8 34-1" fill="none" stroke="#394B50" strokeWidth=".9" />
        <path d="M482 194c12-19 28-25 47-18 10 17 7 34-9 48-18-3-31-13-38-30Z" fill="#DCEBE0" fillOpacity=".55" stroke="#394B50" strokeWidth="1.4" />
        <path d="M487 218c11-20 23-31 40-40m-33 43c10-12 20-21 31-28" fill="none" stroke="#394B50" strokeWidth=".8" />
        <path d="M560 112c8-8 17-8 26 0-9 7-18 7-26 0Zm-5 5 37-11" fill="none" stroke="#394B50" strokeWidth="1.2" strokeLinecap="round" />
        <path d="m255 192 3-10 3 10 10 3-10 3-3 10-3-10-10-3Zm254-52 2-7 2 7 7 2-7 2-2 7-2-7-7-2Z" fill="#F3B58D" fillOpacity=".78" stroke="#394B50" strokeWidth=".8" />
        <path d="M72 253c24-14 38-15 56-3m-47 12c16-8 30-9 43-3m-29 11c11-4 20-4 30 0M601 289c17-13 31-17 47-12m-41 21c12-8 24-11 36-8" fill="none" stroke="#59666A" strokeWidth="1" strokeLinecap="round" opacity=".68" />
        <path d="M89 198c9-13 20-19 35-20m-30 27c8-11 17-17 29-19m391-68c11-12 22-16 36-13m-29 20c9-9 18-12 28-11" fill="none" stroke="#394B50" strokeWidth=".9" opacity=".75" />
        <path d="M119 240c-4-21 4-36 24-44 17 10 22 25 14 43-13-5-26-5-38 1Z" fill="#FFFDF7" fillOpacity=".76" stroke="#394B50" strokeWidth="1.35" />
        <path d="M122 240c12-11 24-15 37-15m-34 20c10-8 19-11 30-11m-20-32 5 10m8-13 4 11m7-8 2 11" fill="none" stroke="#394B50" strokeWidth=".8" />
        <path d="M535 213c15-18 33-22 52-12 9 17 6 33-9 47-18-6-32-17-43-35Z" fill="#FFFDF7" fillOpacity=".72" stroke="#394B50" strokeWidth="1.35" />
        <path d="M538 217c16-8 31-12 47-11m-37 18c13-7 25-10 38-9m-29-24 6 9m7-11 5 10m7-9 3 10" fill="none" stroke="#394B50" strokeWidth=".8" />
        <path d="M211 259c38-16 74-18 112-7m-108 4c33-14 63-17 92-10m172-74c22-9 41-10 61-4m-54 9c18-7 34-8 49-4" fill="none" stroke="#394B50" strokeWidth=".7" opacity=".65" />
        <path d="m99 172 3-9 3 9 9 3-9 3-3 9-3-9-9-3Zm408 66 2-7 2 7 7 2-7 2-2 7-2-7-7-2Z" fill="#F3B58D" fillOpacity=".7" stroke="#394B50" strokeWidth=".8" />
        <path d="M178 293c4-7 9-11 15-13m-8 19c4-6 8-9 13-11m357-45c5-6 10-9 17-10m-9 17c5-5 9-7 14-8" fill="none" stroke="#167D83" strokeWidth="1.1" opacity=".7" />
        <path d="M136 329c16-4 29-5 43-3m-16-8 5-6 5 7m176-5c17-4 32-4 46-2m-17-9 5-6 5 7" fill="none" stroke="#394B50" strokeWidth=".75" opacity=".57" />
        <path d="M313 183c-12-10-25-14-39-13m64-16c11-10 24-14 39-12m30 18c12-9 25-12 39-9" fill="none" stroke="#394B50" strokeWidth=".85" strokeLinecap="round" />
        </g>
      </svg>
    );
  }
  if (type === 'login') {
    return (
      <svg className="focus-illustration" viewBox="0 0 520 520" role="img" aria-label="שולחן עבודה שקט עם מחברת פתוחה, עיפרון, ספל וענף קטן">
        <SketchPaperDefs id="signature-login" />
        <rect width="520" height="520" fill="#F4EFE5" />
        <rect width="520" height="520" fill="url(#signature-login-paper)" />
        <ellipse cx="250" cy="248" rx="185" ry="160" fill="url(#signature-login-wash-peach)" />
        <ellipse cx="386" cy="326" rx="96" ry="117" fill="url(#signature-login-wash-teal)" />
        <g filter="url(#signature-login-pencil)">
        <path d="M35 405c94-8 171-12 255-5 69 6 133 7 198-4m-461 12c94-9 180-12 265-6 68 5 125 5 190-5" fill="none" stroke="#394B50" strokeWidth="1.1" opacity=".7" />
        <path d="M94 271c43-28 94-38 151-31l20 117c-52-13-105-9-159 17Z" fill="#FFFDF7" stroke="#394B50" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M267 240c49-20 99-23 150-11l-20 120c-47-9-90-2-135 16Z" fill="#FFFDF7" stroke="#394B50" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M264 244c-5 35-1 74 4 114m-1-104c-2 31 1 61 4 92" fill="none" stroke="#394B50" strokeWidth="1" />
        <path d="M112 285c37-13 75-19 113-14m-106 28c31-10 65-14 99-10m-90 25c34-9 63-11 95-8m68-45c35-12 71-16 106-11m-107 28c33-9 64-11 96-7m-99 25c29-7 58-9 87-5" fill="none" stroke="#58666A" strokeWidth=".8" strokeLinecap="round" opacity=".7" />
        <path d="M96 267c47-29 96-37 146-30l-5 10c-48-6-90 1-132 26Zm178-27c43-18 88-21 139-10l-6 11c-45-9-83-4-125 15Z" fill="url(#signature-login-hatch)" opacity=".62" />
        <path d="M126 374c42-16 83-20 125-11m-117 17c37-12 74-15 110-8m31-3c32-12 62-15 96-10m-84 18c27-8 51-9 75-5" fill="none" stroke="#394B50" strokeWidth=".7" opacity=".55" />
        <path d="M353 191c-1-8 8-14 22-15 14-1 24 4 25 12l-4 47c-1 14-9 22-22 22-13 0-20-8-20-21Z" fill="#F7F1E5" fillOpacity=".82" stroke="#394B50" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M356 191c2 6 10 9 21 8 12-1 20-5 22-11m-40 4c4 4 11 5 19 5 8-1 15-3 19-7" fill="none" stroke="#394B50" strokeWidth="1" />
        <path d="M397 201c15-5 23 0 22 12-1 13-9 19-24 18m4-22c8-2 12 1 11 7-1 7-4 10-12 10" fill="none" stroke="#394B50" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M355 241c14 3 27 2 40-2m-37 7c11 2 23 2 34-1m-28 7c8 1 16 1 23-1" fill="none" stroke="#394B50" strokeWidth=".8" opacity=".76" />
        <ellipse cx="376" cy="271" rx="37" ry="8" fill="#F7F1E5" fillOpacity=".65" stroke="#394B50" strokeWidth="1.2" />
        <path d="M344 271c11 6 24 9 39 8 12-1 22-3 29-8m-62 4c12 5 24 7 36 6" fill="none" stroke="#394B50" strokeWidth=".8" />
        <path d="M359 180c-5-8-5-14 0-20m13 19c-2-10 1-17 7-23m11 24c1-8 4-14 10-19" fill="none" stroke="#59666A" strokeWidth="1.1" strokeLinecap="round" opacity=".8" />
        <path d="M348 280c18 4 36 3 55-2m-47 8c14 3 27 2 40-1" fill="none" stroke="#394B50" strokeWidth=".8" />
        <path d="M346 283c17 2 34 0 51-5l9 23c-19 8-38 9-57 3Z" fill="url(#signature-login-hatch)" opacity=".55" />
        <path d="m145 184 120 159m-8-10 8-8-8-9-8 8Zm-114-151 12 10m-3 3 10-8m-3 14 8-7" fill="none" stroke="#394B50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m147 186 112 149m-106-141 11-7m-4 16 11-7m-3 15 11-8m-2 15 11-8m-2 16 11-8m-3 16 11-8m-2 15 10-8" fill="none" stroke="#394B50" strokeWidth=".75" opacity=".7" />
        <path d="M427 355c-1-64 13-109 42-140m-32 97c-31-8-45-28-40-60 32 2 47 22 40 60Zm8-41c4-32 22-48 53-47 5 30-11 46-53 47Zm-6-19c-18-21-18-42 1-63 24 17 25 38-1 63Z" fill="none" stroke="#394B50" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M425 353c5-41 20-75 44-102m-42 58c-21-8-31-22-30-42m47 2c18-9 31-8 43 0" fill="none" stroke="#167D83" strokeWidth=".9" opacity=".72" />
        <path d="M393 370c17-12 42-16 69-10" fill="none" stroke="#394B50" strokeWidth="1" />
        <path d="M193 228c11-11 24-11 35 0-11 9-23 9-35 0Zm-2-3 40 7m-30-19 1-8 3 7 8 2-8 2-3 8-2-8-8-2Z" fill="none" stroke="#394B50" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M75 433c58-8 112-9 169-4m-156 8c54-7 101-8 148-4m151-6c31 1 65-1 99-6" fill="none" stroke="#394B50" strokeWidth=".7" opacity=".52" />
        <path d="M328 245c20-12 42-16 63-12m-56 17c17-9 34-12 51-9m-38 23c11-4 22-5 34-3m-204-17c14-8 29-11 45-10m-40 16c13-6 26-8 39-7" fill="none" stroke="#394B50" strokeWidth=".85" opacity=".66" />
        <path d="M331 229c7-21 21-33 42-36m-36 44c11-17 23-26 39-29m-36 42c8-11 17-18 29-22m-44 28c10-8 18-12 28-15" fill="none" stroke="#394B50" strokeWidth=".8" />
        <path d="M365 165c9-4 17-3 24 2m-29 6c9-3 17-3 24 1m-20 7c7-2 13-1 19 2" fill="none" stroke="#394B50" strokeWidth=".8" opacity=".7" />
        <path d="M384 291c7 3 15 3 23 0m-21 6c6 2 12 2 18 0m-14-44 14-1m-16-6 13-1m-11-6 10-1" fill="none" stroke="#394B50" strokeWidth=".8" />
        <path d="M400 350c10-6 20-8 31-6m-24 12c8-5 15-6 23-5m-306 52c37-11 72-14 109-10m-91 18c28-7 54-9 82-6" fill="none" stroke="#394B50" strokeWidth=".75" opacity=".7" />
        <path d="m308 201 2-8 3 8 8 2-8 3-3 8-2-8-8-3Zm160 70 2-7 2 7 7 2-7 2-2 7-2-7-7-2Z" fill="#F3B58D" fillOpacity=".65" stroke="#394B50" strokeWidth=".7" />
        <path d="M424 382c12-4 24-5 37-3m-25 8c8-2 15-2 22-1m-363-40c12-7 24-9 37-7m-31 13c9-4 17-5 25-4" fill="none" stroke="#167D83" strokeWidth=".9" opacity=".72" />
        </g>
      </svg>
    );
  }
  if (type === 'register') {
    return (
      <svg className="focus-illustration" viewBox="0 0 540 500" role="img" aria-label="עיפרון מצייר שביל מתפתל שהופך לספרים ורעיונות חדשים">
        <SketchPaperDefs id="signature-register" />
        <rect width="540" height="500" fill="#F5F0E6" />
        <rect width="540" height="500" fill="url(#signature-register-paper)" />
        <ellipse cx="343" cy="148" rx="142" ry="116" fill="url(#signature-register-wash-teal)" />
        <ellipse cx="183" cy="346" rx="124" ry="105" fill="url(#signature-register-wash-peach)" />
        <g filter="url(#signature-register-pencil)">
        <path d="M76 435c68-4 122-23 158-64 34-38 29-68-5-84-25-12-48-7-59 11-9 16-2 33 17 36 20 3 39-8 49-27 17-34 4-65-25-73-27-7-52 0-71 20" fill="none" stroke="#394B50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M79 439c71-3 125-21 161-62 34-38 31-70-5-88-28-14-53-6-63 15-8 17 2 35 21 37 22 3 42-8 53-29 18-35 4-69-27-77-29-7-57 0-78 22" fill="none" stroke="#394B50" strokeWidth=".8" strokeLinecap="round" opacity=".65" />
        <path d="M110 418c-12 7-24 13-36 17m16-25c-8 10-15 19-22 28m39-33c-11 13-20 23-29 32m49-41c-8 12-17 22-28 31" fill="none" stroke="#394B50" strokeWidth=".8" opacity=".7" />
        <path d="M166 392c12 5 22 12 31 21m-43-10c14 4 27 12 37 24m-52-16c11 4 19 10 27 18" fill="none" stroke="#167D83" strokeWidth="2.3" strokeLinecap="round" opacity=".72" />
        <path d="M352 350c43-4 76-3 110 4l-2 54c-37-6-72-5-109 3Z" fill="#FFFDF7" stroke="#394B50" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M354 350c-2 17-2 38-1 59m6-48c26-3 51-3 78 1m-78 10c23-2 47-1 71 3m-70 9c20-1 39 1 58 4" fill="none" stroke="#59666A" strokeWidth=".8" />
        <path d="M349 351c39-7 76-7 116 1m-109-8c33-5 66-4 101 2" fill="none" stroke="#394B50" strokeWidth=".8" opacity=".62" />
        <path d="M365 337c33-4 61-2 90 4l-2 12c-29-6-58-7-87-2Z" fill="#DDEBE2" stroke="#394B50" strokeWidth="1.3" />
        <path d="M367 340c27-2 53-1 79 4m-76 1c23-2 45-1 68 3" fill="none" stroke="#394B50" strokeWidth=".65" />
        <path d="M377 324c29-5 55-4 80 2l-3 11c-24-5-49-6-75-2Z" fill="#F2E0D0" stroke="#394B50" strokeWidth="1.2" />
        <path d="M382 328c22-3 42-2 65 2m-61 4c19-2 37-1 55 2" fill="none" stroke="#394B50" strokeWidth=".65" />
        <path d="M302 269c18-23 42-30 68-21 19 7 29 22 28 43-23-8-43-5-61 6-15 9-27 1-35-28Z" fill="#E1ECE2" fillOpacity=".7" stroke="#394B50" strokeWidth="1.5" />
        <path d="M309 280c18-17 36-25 62-26m-51 37c15-11 31-17 48-19m-39 28c13-7 24-11 37-12" fill="none" stroke="#394B50" strokeWidth=".8" />
        <path d="M309 291c-2-26 8-44 29-56 22 14 31 33 25 57" fill="none" stroke="#394B50" strokeWidth="1.3" />
        <path d="M328 245c8-8 19-9 28-1m-25 8c7-5 14-5 21-1" fill="none" stroke="#167D83" strokeWidth="1.5" />
        <path d="m418 275 3-11 4 11 11 4-11 3-4 11-3-11-11-3Zm-83-32 2-7 2 7 7 2-7 2-2 7-2-7-7-2Z" fill="#EFC09F" fillOpacity=".7" stroke="#394B50" strokeWidth=".8" />
        <path d="M75 462c65-6 117-20 156-45m-142 48c51-5 94-15 129-33m155-59 91 1m-84 8 78 1" fill="none" stroke="#394B50" strokeWidth=".7" opacity=".52" />
        <path d="M105 435c19-10 36-21 51-35m-39 40c18-8 33-17 46-28m-31 34c14-6 26-13 37-22m-26 30c12-5 22-10 32-17" fill="none" stroke="#394B50" strokeWidth=".8" opacity=".68" />
        <path d="M180 321c-12-11-15-23-8-37m15 44c-9-8-12-17-10-26m28 11c14-11 20-23 18-37m-9 45c12-8 18-18 20-31" fill="none" stroke="#394B50" strokeWidth=".9" />
        <path d="M368 379c34-5 67-4 100 2m-91 7c25-3 48-2 70 1m-50-45c19-4 38-4 57-1m-53-66c12-7 24-9 37-5m-27 12c9-4 17-5 25-3" fill="none" stroke="#394B50" strokeWidth=".8" opacity=".72" />
        <path d="M389 310c8-13 17-20 31-22m-26 29c9-10 18-15 29-16m-79-11c-8-11-10-23-5-36m16 34c1-14 6-24 16-33" fill="none" stroke="#167D83" strokeWidth="1" opacity=".77" />
        <path d="m455 298 2-8 3 8 8 2-8 3-3 8-2-8-8-3Zm-86-62 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z" fill="#F3B58D" fillOpacity=".73" stroke="#394B50" strokeWidth=".7" />
        <path d="M257 413c13 3 24 2 35-2m-30 8c8 2 16 1 23-1m160-27c13 4 25 4 38 1m-29 7c9 2 17 2 25 0" fill="none" stroke="#394B50" strokeWidth=".75" />
        <path d="M308 203c9-8 19-11 30-9m-24 15c7-5 14-7 21-6m111 69c13-4 24-4 36-1m-29 8c9-2 17-2 25 0" fill="none" stroke="#394B50" strokeWidth=".75" opacity=".65" />
        </g>
      </svg>
    );
  }
  if (type === 'dashboard') {
    return (
      <svg className="focus-illustration" viewBox="0 0 760 310" role="img" aria-label="ספרים מצוירים נערמים למדרגות המובילות לרעיון מואר">
        <SketchPaperDefs id="signature-dashboard" />
        <rect width="760" height="310" fill="#F5F0E5" />
        <rect width="760" height="310" fill="url(#signature-dashboard-paper)" />
        <ellipse cx="573" cy="97" rx="104" ry="86" fill="url(#signature-dashboard-wash-peach)" />
        <ellipse cx="229" cy="218" rx="172" ry="105" fill="url(#signature-dashboard-wash-teal)" />
        <g filter="url(#signature-dashboard-pencil)">
        <path d="M61 275c87-16 158-16 222-3m-213 9c78-12 143-12 204-2m225-5c53-13 99-17 153-11m-139 19c46-9 86-12 131-9" fill="none" stroke="#394B50" strokeWidth="1" opacity=".55" />
        <path d="m105 241 140-3 19 17-142 7Zm20 21 148-5 18 16-150 8Zm26 21 157-8 19 15-160 10Z" fill="#DDEBE2" stroke="#394B50" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="m106 244 140-3m-122 17 146-4m-123 19 156-7m-149-17 20 17m-5 4 19 17m-3 3 21 17" fill="none" stroke="#394B50" strokeWidth=".8" opacity=".72" />
        <path d="m122 238 20 17m-8-16 19 17m-6-17 19 16m-5-16 18 16m-4-17 18 16m-4-16 17 16m-4-16 18 15" fill="none" stroke="#394B50" strokeWidth=".7" opacity=".46" />
        <path d="m264 211 116-5 18 16-118 8Zm17 20 123-8 18 16-126 11Zm20 21 132-11 18 15-135 14Z" fill="#F1E3D4" stroke="#394B50" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="m265 214 114-5m-98 22 120-8m-100 24 129-10m-119-19 20 15m-4 5 21 16m-3 4 21 16" fill="none" stroke="#394B50" strokeWidth=".8" opacity=".7" />
        <path d="m282 207 18 15m-6-16 18 15m-5-16 18 15m-4-16 18 15m-5-16 18 15m-4-16 17 14m-4-14 16 13" fill="none" stroke="#394B50" strokeWidth=".7" opacity=".47" />
        <path d="m398 178 93-7 17 14-95 10Zm15 19 101-11 18 15-104 14Z" fill="#D6E6DE" stroke="#394B50" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="m400 181 91-7m-75 26 99-10m-83 0 16 13m-2 5 18 14m-2 4 21 15" fill="none" stroke="#394B50" strokeWidth=".8" opacity=".7" />
        <path d="M501 175c2-20 15-32 34-32 19 0 31 12 32 31l-11 17h-45Z" fill="#F8F1E2" fillOpacity=".9" stroke="#394B50" strokeWidth="1.8" />
        <path d="M513 178c7-12 22-16 39-9m-31 13c7-7 16-9 25-7m-25 10h25m-22 6h19m-15 6v8h12v-8" fill="none" stroke="#394B50" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M508 165c8-15 20-22 35-21m-30 30c8-7 17-10 28-9m-22 29c8 2 16 2 24 0" fill="none" stroke="#167D83" strokeWidth="1.2" opacity=".78" />
        <path d="m531 125 1-14m20 20 12-9m-47 7-10-10m22-4 4-12m29 35 12 1" fill="none" stroke="#394B50" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M573 197c16-23 35-31 59-24 16 11 20 28 12 48-24-10-45-8-65 4m-3-27c20-11 40-14 61-8m-54 21c15-6 29-8 44-6" fill="#E4ECE0" fillOpacity=".6" stroke="#394B50" strokeWidth="1.2" />
        <path d="M575 221c17-16 35-27 55-34m-44 39 34-27" fill="none" stroke="#394B50" strokeWidth=".8" />
        <path d="M178 227c-15-24-11-45 13-64 18 25 14 45-13 64Zm1-1c4-27 21-43 51-45-1 27-18 42-51 45Z" fill="none" stroke="#394B50" strokeWidth="1.2" />
        <path d="M179 227c13-18 28-31 48-41m-45 42c-21-13-31-30-29-51m63 18c14-8 25-9 37-4" fill="none" stroke="#167D83" strokeWidth=".9" />
        <path d="M563 96c13-12 27-13 42-2-13 11-27 12-42 2Zm-4-5 50 6m-20-24 2-9 3 9 9 3-9 3-3 9-2-9-9-3Z" fill="none" stroke="#394B50" strokeWidth="1" strokeLinecap="round" />
        <path d="M110 236c24-7 47-10 70-9m-60 15c18-5 35-6 51-6m-33 34c29-7 58-9 88-6m-79 13c22-5 42-6 61-5m37-56 18 15m-9-17 18 15m-9-16 18 15m-8-16 18 14m-8-15 17 14m-7-14 15 13" fill="none" stroke="#394B50" strokeWidth=".8" opacity=".68" />
        <path d="m296 201 18 15m-9-17 18 15m-9-16 18 15m-9-15 17 14m4 8 16 14m-8-17 18 14m-9-15 18 14m-8-15 17 13" fill="none" stroke="#394B50" strokeWidth=".75" opacity=".66" />
        <path d="M445 166c17-7 33-10 50-8m-43 14c13-5 25-7 38-6m15 40c14-3 27-2 40 2m-32 6c10-2 19-1 28 1" fill="none" stroke="#394B50" strokeWidth=".8" />
        <path d="M531 153c-1-11 3-20 11-28m-5 35c3-10 7-17 14-23m-17 53c13 3 24 2 35-2m-30 8c8 1 16 1 23-1m-363 10c17-7 31-9 47-7" fill="none" stroke="#167D83" strokeWidth=".9" opacity=".76" />
        <path d="M594 225c15-10 30-14 46-12m-37 20c11-6 22-9 33-8m-369 36c13-4 25-4 37-2m-25 8c8-2 16-2 23 0" fill="none" stroke="#394B50" strokeWidth=".8" opacity=".72" />
        <path d="m660 118 2-7 3 7 7 2-7 2-3 7-2-7-7-2Zm-79 86 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z" fill="#F3B58D" fillOpacity=".7" stroke="#394B50" strokeWidth=".75" />
        <path d="M205 189c11-7 21-9 32-7m-25 13c8-4 15-5 22-4m224 52c12-5 23-6 35-4m-27 11c9-3 17-3 25-2" fill="none" stroke="#394B50" strokeWidth=".7" opacity=".62" />
        </g>
      </svg>
    );
  }
  return (
    <svg className="focus-illustration" viewBox="0 0 760 390" role="img" aria-label="מחברת למידה בעיפרון מוקפת בשעון, נורה, עיפרון וקשרי רעיונות">
      <SketchPaperDefs id="signature-smart" />
      <rect width="760" height="390" fill="#F4EFE5" />
      <rect width="760" height="390" fill="url(#signature-smart-paper)" />
      <ellipse cx="394" cy="206" rx="218" ry="132" fill="url(#signature-smart-wash-teal)" />
      <ellipse cx="211" cy="116" rx="111" ry="89" fill="url(#signature-smart-wash-peach)" />
      <g filter="url(#signature-smart-pencil)">
      <path d="M239 124c49-21 100-23 153-7l-7 150c-51-13-98-9-150 12Z" fill="#FFFDF7" stroke="#394B50" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M391 116c50-25 102-30 157-18l-11 151c-50-9-95 0-146 23Z" fill="#FFFDF7" stroke="#394B50" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M387 120c-5 43-4 95 3 146m-1-137c-4 39-3 83 3 120" fill="none" stroke="#394B50" strokeWidth="1.1" />
      <path d="M259 144c38-12 76-14 115-7m-109 21c34-10 67-11 102-5m-96 21c30-8 59-8 89-3m-82 21c27-6 53-6 79-2m-94 24c32-8 61-9 93-3m-70 23c27-5 51-5 76-1m51-82c38-16 76-21 116-14m-113 34c35-12 69-15 104-10m-109 31c30-9 59-10 89-7m-93 27c26-6 51-7 76-5m-83 25c21-5 42-6 63-4" fill="none" stroke="#536267" strokeWidth=".85" strokeLinecap="round" opacity=".78" />
      <path d="M235 119c51-24 103-27 160-11l-5 11c-53-12-99-9-150 14Zm158-10c55-27 109-33 160-21l-5 12c-48-10-95-4-148 20Z" fill="url(#signature-smart-hatch)" opacity=".55" />
      <path d="M266 276c45-15 89-15 131-4m-118 9c41-13 78-13 114-4m20-5c45-19 88-25 133-18m-121 26c40-14 75-19 113-15" fill="none" stroke="#394B50" strokeWidth=".7" opacity=".54" />
      <circle cx="135" cy="126" r="51" fill="#F7F1E5" fillOpacity=".69" stroke="#394B50" strokeWidth="1.8" />
      <circle cx="135" cy="126" r="44" fill="none" stroke="#394B50" strokeWidth=".75" strokeDasharray="1 3" />
      <path d="M135 87v7m0 64v7m-39-39h7m64 0h7m-39-39v7m-28 4 5 5m50 50 5 5m0-60-5 5m-50 50-5 5" fill="none" stroke="#394B50" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M136 125 158 109m-23 17v-24" fill="none" stroke="#167D83" strokeWidth="2" strokeLinecap="round" />
      <circle cx="135" cy="126" r="3" fill="#F3B58D" stroke="#394B50" strokeWidth=".8" />
      <path d="M594 106c1-22 16-37 38-37 22 0 37 14 37 35 0 16-9 25-18 35-6 7-8 13-8 20h-25c0-11-2-17-9-24-9-9-15-17-15-29Z" fill="#F7F1E5" fillOpacity=".82" stroke="#394B50" strokeWidth="1.8" />
      <path d="M614 167h31m-28 7h25m-22 7h19m-10-83c-10 2-16 9-17 19m38-19c8 4 12 11 12 20" fill="none" stroke="#394B50" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M615 105c8-11 19-14 33-7m-29 14c8-7 16-9 25-6" fill="none" stroke="#E3AD85" strokeWidth="2" strokeLinecap="round" />
      <path d="m674 114 2-8 3 8 8 3-8 2-3 8-2-8-8-2Zm-97-48 2-7 2 7 7 2-7 2-2 7-2-7-7-2Z" fill="none" stroke="#394B50" strokeWidth="1" />
      <path d="m541 263 15-131 11 2-15 131-8 15Z" fill="#E8D7C2" stroke="#394B50" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m541 263 11 2-8 15Z" fill="#394B50" />
      <path d="m548 250 11-2m-8-17 11-2m-8-17 11-2m-7-17 11-2m-7-17 11-2m-7-17 11-2m-7-17 11-2" fill="none" stroke="#394B50" strokeWidth=".7" opacity=".76" />
      <path d="M102 261c22-14 42-16 63-5m-56 14c17-8 32-9 47-4m-31 12c11-4 20-4 29-1m453 38c17-12 34-15 52-8m-44 17c13-7 25-9 37-6" fill="none" stroke="#394B50" strokeWidth="1" strokeLinecap="round" />
      <path d="m182 125 27-17 19 29-26 17Zm4 1 29 6m-19-22 16 25m-31-9 26-17" fill="none" stroke="#167D83" strokeWidth="1" strokeDasharray="3 4" opacity=".8" />
      <circle cx="182" cy="125" r="5" fill="#F3B58D" stroke="#394B50" strokeWidth="1" />
      <circle cx="209" cy="108" r="5" fill="#D7E7DA" stroke="#394B50" strokeWidth="1" />
      <circle cx="228" cy="137" r="5" fill="#F3B58D" stroke="#394B50" strokeWidth="1" />
      <path d="M476 86c13-11 27-12 42-2-13 10-27 11-42 2Zm-2-4 49 5m-43 187c14-12 27-13 42-3-13 10-27 11-42 3Z" fill="none" stroke="#394B50" strokeWidth="1" strokeLinecap="round" />
      <path d="M273 131c30-13 59-17 88-13m-81 19c23-9 45-12 67-10m-72 41c22-5 42-5 62-2m-45 21c19-4 36-4 53-2m102-65c33-13 64-17 98-11m-91 20c28-9 54-12 81-9m-79 36c21-6 42-8 63-6m-59 22c18-4 34-5 50-3" fill="none" stroke="#394B50" strokeWidth=".75" opacity=".65" />
      <path d="M128 92c15-13 34-18 53-14m-47 22c13-10 25-14 38-12m434-33c12-9 25-13 39-11m-32 18c9-6 19-9 28-8m-11 172c15-10 30-12 45-7m-36 14c11-6 22-7 32-5" fill="none" stroke="#394B50" strokeWidth=".8" opacity=".68" />
      <path d="M96 294c18-13 38-17 58-13m-50 21c14-9 29-13 44-11m445-36c15-11 31-14 48-10m-40 18c12-7 24-10 35-8" fill="none" stroke="#167D83" strokeWidth=".9" opacity=".75" />
      <path d="M108 153c-8 16-10 31-6 46m470-15c-6 15-8 29-6 44m-391 67c9-7 18-10 29-11m21 6 10 2m-5-8 5 8 5-8" fill="none" stroke="#394B50" strokeWidth=".85" opacity=".7" />
      <path d="m196 101 2-7 3 7 7 2-7 2-3 7-2-7-7-2Zm350 1 2-7 3 7 7 2-7 2-3 7-2-7-7-2Zm-90 195 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z" fill="#F3B58D" fillOpacity=".65" stroke="#394B50" strokeWidth=".7" />
      <path d="M282 287c17-6 32-8 49-5m-39 12c12-4 23-5 34-3m111-16c18-7 35-9 53-6m-43 13c13-4 25-5 36-3" fill="none" stroke="#394B50" strokeWidth=".75" opacity=".67" />
      </g>
    </svg>
  );
}

export default function FocusIllustration({ type }) {
  return <Scene type={type} />;
}
