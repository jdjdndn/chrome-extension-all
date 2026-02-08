Array.from(new Set(["5apomd.com", "ssaa4640203182.btioh.com", "yx6wis7.com", "klkwe22.com", "hfjh842.net", "jfuww78.com", "tyh.tysh98766.com", "dsh.d8shu9766hu.com", "ayy.f23sihu983tt.com", "huu.shhu88w5766.com", "1gt5gm.cc", "glbfai.cc", "apt.ap914954.cc", "qobyxr.cc", "jat.jhin7v.live", "zymdcscw7dcdsc9whsdcdh.aoc81s.com", "1y6g92.cc", "950k3757.cc", "monkey.cszpra.com", "88w.bgbfds.com", 'monkey.cszpra.com', 'img.alicdn.com', 'monkey.cszpra.com', 'onkey.csapra.com', 'monkey.csapra.com', 'monkey.cszpra.com', '88w.bgbfds.com', '88w.bgbfds.com', '88w.bgbfds.com', '88w.bgbfds.com', 'hongniu.ewytek.com', 'hongniu.ewytek.com', 'hongniu.ewytek.com', 'hongniu.ewytek.co', 'hongniu.ewytek.com', 'hongniu.ewytek.com', 'hongniu.ewytek.com', 'hongniu.ewytek.com', 'hongniu.ewytek.com', 'hongniu.ewytek.com', 'hongniu.ewytek.com', 'hongniu.ewytek.com', 'hongniu.ewytek.com', 'hongniu.ewytek.cn', 'hongniu.ewytek.com', 'hongniu.ewytek.com', 'hongniu.ewytek.com', 'hongniu.ewytek.com', 'hongniu.ewytek.com', 'hongniu.ewytek.com', 'hongniu.ewytek.com', 'mapjgeachilmcbbokkgcbgpbakaaeehi',
  "5apomd.com",
  "ssaa4640203182.btioh.com",
  "yx6wis7.com",
  "klkwe22.com",
  "hfjh842.net",
  "jfuww78.com",
  "tyh.tysh98766.com",
  "dsh.d8shu9766hu.com",
  "ayy.f23sihu983tt.com",
  "huu.shhu88w5766.com",
  "1gt5gm.cc",
  "glbfai.cc",
  "apt.ap914954.cc",
  "qobyxr.cc",
  "jat.jhin7v.live",
  "zymdcscw7dcdsc9whsdcdh.aoc81s.com",
  "1y6g92.cc",
  "950k3757.cc",
  "monkey.cszpra.com",
  "88w.bgbfds.com"
])).map(function (domain, i) {
  let obj = {
    "id": i + 1,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "urlFilter": "||" + domain,
      "resourceTypes": ["xmlhttprequest", "script", "image"]
    }
  }
  return obj;
});