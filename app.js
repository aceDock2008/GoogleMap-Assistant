const { createApp, ref, computed, onMounted, nextTick } = Vue;

createApp({
  setup() {
    // --- State Variables ---
    const currentTab = ref('ai'); // 'ai', 'places', 'add', 'settings'
    const places = ref([]);
    const apiKey = ref('');
    const userLocation = ref(null); // { lat, lng }
    const locating = ref(false);
    const showTutorial = ref(false);

    // API Key test state
    const testingKey = ref(false);
    const keyTestResult = ref('');
    const keyTestSuccess = ref(false);

    // AI & Search state
    const userInput = ref('');
    const aiResponse = ref('');
    const aiLoading = ref(false);
    const allowExternal = ref(true); // Default true: allow outside places
    const recommendedPlaces = ref([]);
    const quickPrompts = [
      '離我最近有哪些拉麵店？推薦一家',
      '附近有什麼適合喝咖啡的待去店家？',
      '離我 2 公里內有什麼我還沒去過的私房景點？',
      '有哪些評分高或有備忘筆記的美食？'
    ];

    // Places tab state
    const searchQuery = ref('');
    const selectedCategory = ref('all');

    // Add tab state
    const newPlaceUrl = ref('');
    const parsingUrl = ref(false);
    const manualForm = ref({
      name: '',
      category: '',
      address: '',
      lat: null,
      lng: null,
      note: ''
    });

    // --- Haversine Distance Calculation (km) ---
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      if (!lat1 || !lon1 || !lat2 || !lon2) return null;
      const R = 6371; // Earth radius in km
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const formatDistance = (dist) => {
      if (dist === null || dist === undefined) return '未知距離';
      if (dist < 1) {
        return `${Math.round(dist * 1000)} 公尺`;
      }
      return `${dist.toFixed(1)} 公里`;
    };

    // --- GPS Geolocation ---
    const refreshLocation = () => {
      if (!navigator.geolocation) {
        alert('您的瀏覽器不支援 GPS 定位');
        return;
      }
      locating.value = true;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          userLocation.value = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          locating.value = false;
          updateAllDistances();
        },
        (error) => {
          console.warn('GPS Error:', error);
          locating.value = false;
          // Fallback location (e.g. Taipei 101 or Station) if user denies, or inform
          if (!userLocation.value) {
            // Preset fallback to Taipei Main Station for easy demo/testing
            userLocation.value = { lat: 25.0478, lng: 121.5170 };
            updateAllDistances();
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    };

    const updateAllDistances = () => {
      if (!userLocation.value) return;
      places.value = places.value.map((p) => {
        const dist = (p.lat && p.lng)
          ? calculateDistance(userLocation.value.lat, userLocation.value.lng, p.lat, p.lng)
          : null;
        return { ...p, distance: dist };
      });
      savePlaces();
    };

    // --- Local Storage Management ---
    const loadSavedData = () => {
      const storedKey = localStorage.getItem('mapai_gemini_key');
      if (storedKey) apiKey.value = storedKey;

      const storedPlaces = localStorage.getItem('mapai_places');
      if (storedPlaces) {
        try {
          places.value = JSON.parse(storedPlaces);
        } catch (e) {
          places.value = [];
        }
      } else {
        // First time users can have sample data loaded
        loadSampleData();
      }
    };

    const savePlaces = () => {
      localStorage.setItem('mapai_places', JSON.stringify(places.value));
      nextTick(() => {
        if (window.lucide) lucide.createIcons();
      });
    };

    const saveApiKey = () => {
      localStorage.setItem('mapai_gemini_key', apiKey.value.trim());
      alert('API Key 已儲存至手機本機！');
    };

    const testApiKey = async () => {
      const key = apiKey.value.trim();
      if (!key) {
        alert('請先輸入 API Key');
        return;
      }
      testingKey.value = true;
      keyTestResult.value = '正在連線向 Google 伺服器驗證金鑰...';
      keyTestSuccess.value = false;

      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await resp.json();

        if (!resp.ok) {
          keyTestSuccess.value = false;
          keyTestResult.value = `❌ 驗證失敗：${data.error?.message || '未知錯誤'} (錯誤碼: ${data.error?.code})`;
        } else {
          const genModels = (data.models || [])
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace('models/', ''));

          if (genModels.length > 0) {
            keyTestSuccess.value = true;
            keyTestResult.value = `✅ 連線成功！此金鑰支援 ${genModels.length} 個 AI 模型：\n${genModels.slice(0, 4).join(', ')}`;
          } else {
            keyTestSuccess.value = false;
            keyTestResult.value = `⚠️ 金鑰連線成功，但 Google 帳號尚未為此金鑰開通 generateContent 權限。`;
          }
        }
      } catch (err) {
        keyTestSuccess.value = false;
        keyTestResult.value = `❌ 連線發生網路錯誤：${err.message}`;
      } finally {
        testingKey.value = false;
      }
    };

    // --- Computed Views ---
    const sortedPlaces = computed(() => {
      return [...places.value].sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    });

    const categories = computed(() => {
      const set = new Set();
      places.value.forEach((p) => {
        if (p.category) {
          p.category.split(/[,/、\s]+/).forEach((cat) => {
            const trimmed = cat.trim();
            if (trimmed) set.add(trimmed);
          });
        }
      });
      return Array.from(set);
    });

    const filteredPlaces = computed(() => {
      return sortedPlaces.value.filter((p) => {
        const matchesSearch =
          !searchQuery.value.trim() ||
          p.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          (p.address && p.address.toLowerCase().includes(searchQuery.value.toLowerCase())) ||
          (p.note && p.note.toLowerCase().includes(searchQuery.value.toLowerCase())) ||
          (p.category && p.category.toLowerCase().includes(searchQuery.value.toLowerCase()));

        const matchesCat =
          selectedCategory.value === 'all' ||
          (p.category && p.category.includes(selectedCategory.value));

        return matchesSearch && matchesCat;
      });
    });

    // --- Quick Add & Smart Clipboard Parsing ---
    const readFromClipboard = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text) {
            newPlaceUrl.value = text.trim();
            // Automatically parse if contains url
            if (text.includes('http')) {
              parseAndAddUrl();
            }
          } else {
            alert('剪貼簿目前沒有內容，請先在 Google Maps 複製地點連結！');
          }
        } else {
          alert('您的瀏覽器不允許自動讀取剪貼簿，請長按文字框貼上。');
        }
      } catch (err) {
        alert('請手動長按輸入框貼上複製的地點。');
      }
    };

    const parseAndAddUrl = async () => {
      const raw = newPlaceUrl.value.trim();
      if (!raw) return;
      parsingUrl.value = true;

      try {
        let extractedName = '';
        let lat = null;
        let lng = null;
        let category = '餐廳/景點';

        // 1. Check if contains coordinates: @25.0478,121.5170 or ?q=25.0478,121.5170
        const coordMatch = raw.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || raw.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordMatch) {
          lat = parseFloat(coordMatch[1]);
          lng = parseFloat(coordMatch[2]);
        }

        // 2. Extract title if shared via mobile share text (e.g. "隱家拉麵 赤峰店 · 台北市中山區... https://...")
        const lines = raw.split('\n');
        if (lines.length > 0 && !lines[0].startsWith('http')) {
          extractedName = lines[0].split('·')[0].trim();
        }

        // 3. Extract place name from URL pattern if not found
        if (!extractedName) {
          const placeMatch = raw.match(/\/place\/([^\/@?]+)/);
          if (placeMatch) {
            extractedName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
          }
        }

        // 4. Default fallback name
        if (!extractedName) {
          extractedName = 'Google Maps 儲存地點 ' + (places.value.length + 1);
        }

        // Guess category
        if (extractedName.includes('拉麵') || raw.includes('拉麵')) category = '拉麵';
        else if (extractedName.includes('咖啡') || raw.includes('咖啡') || extractedName.includes('Cafe')) category = '咖啡';
        else if (extractedName.includes('景點') || raw.includes('公園') || raw.includes('館')) category = '旅遊景點';
        else if (extractedName.includes('甜點') || extractedName.includes('蛋糕')) category = '甜點';

        // Deduplication check
        const exists = places.value.find((p) => p.name.trim() === extractedName.trim());
        if (exists) {
          alert(`「${extractedName}」已經在您的清單中囉！`);
          parsingUrl.value = false;
          return;
        }

        const newPlace = {
          id: 'p_' + Date.now(),
          name: extractedName,
          category: category,
          address: '',
          lat: lat,
          lng: lng,
          note: '手機捷徑加入',
          url: raw.includes('http') ? raw.match(/(https?:\/\/[^\s]+)/)[0] : '',
          visited: false,
          distance: (userLocation.value && lat && lng)
            ? calculateDistance(userLocation.value.lat, userLocation.value.lng, lat, lng)
            : null
        };

        places.value.unshift(newPlace);
        savePlaces();
        newPlaceUrl.value = '';
        alert(`已成功將「${extractedName}」存入清單！`);
      } catch (e) {
        alert('解析網址時發生問題，您可以直接手動輸入店家名稱。');
      } finally {
        parsingUrl.value = false;
      }
    };

    const addManualPlace = () => {
      if (!manualForm.value.name.trim()) return;

      const newPlace = {
        id: 'p_' + Date.now(),
        name: manualForm.value.name.trim(),
        category: manualForm.value.category.trim() || '未分類',
        address: manualForm.value.address.trim(),
        lat: manualForm.value.lat || null,
        lng: manualForm.value.lng || null,
        note: manualForm.value.note.trim(),
        visited: false,
        distance: (userLocation.value && manualForm.value.lat && manualForm.value.lng)
          ? calculateDistance(userLocation.value.lat, userLocation.value.lng, manualForm.value.lat, manualForm.value.lng)
          : null
      };

      places.value.unshift(newPlace);
      savePlaces();

      manualForm.value = {
        name: '',
        category: '',
        address: '',
        lat: null,
        lng: null,
        note: ''
      };

      alert(`已成功新增「${newPlace.name}」！`);
    };

    const toggleVisited = (place) => {
      place.visited = !place.visited;
      savePlaces();
    };

    const deletePlace = (place) => {
      if (confirm(`確定要將「${place.name}」從清單中移除嗎？`)) {
        places.value = places.value.filter((p) => p.id !== place.id);
        savePlaces();
      }
    };

    const getNavigationUrl = (place) => {
      if (place.lat && place.lng) {
        return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
      }
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + (place.address || ''))}`;
    };

    // --- Google Takeout / CSV / JSON File Import ---
    const handleFileUpload = (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          let importedCount = 0;

          if (file.name.endsWith('.json')) {
            const data = JSON.parse(content);
            // Support GeoJSON format or standard Google Takeout JSON format
            const features = data.features || (Array.isArray(data) ? data : []);
            
            features.forEach((item) => {
              let name = item.properties?.title || item.properties?.Title || item.name || item.title || '';
              let address = item.properties?.address || item.properties?.Address || item.address || '';
              let note = item.properties?.comment || item.note || '';
              let lat = null, lng = null;

              if (item.geometry && item.geometry.coordinates) {
                lng = item.geometry.coordinates[0];
                lat = item.geometry.coordinates[1];
              } else if (item.lat && item.lng) {
                lat = item.lat;
                lng = item.lng;
              }

              if (name && !places.value.find((p) => p.name === name)) {
                let cat = '待訪景點/美食';
                if (name.includes('拉麵')) cat = '拉麵';
                else if (name.includes('咖啡')) cat = '咖啡';

                places.value.push({
                  id: 'p_' + Math.random().toString(36).substr(2, 9),
                  name,
                  category: cat,
                  address,
                  lat,
                  lng,
                  note,
                  visited: false,
                  distance: (userLocation.value && lat && lng)
                    ? calculateDistance(userLocation.value.lat, userLocation.value.lng, lat, lng)
                    : null
                });
                importedCount++;
              }
            });
          } else if (file.name.endsWith('.csv')) {
            // Simple CSV parser
            const lines = content.split('\n');
            for (let i = 1; i < lines.length; i++) {
              const line = lines[i].trim();
              if (!line) continue;
              const cols = line.split(',');
              const name = cols[0]?.replace(/"/g, '').trim();
              if (name && !places.value.find((p) => p.name === name)) {
                places.value.push({
                  id: 'p_' + Math.random().toString(36).substr(2, 9),
                  name,
                  category: cols[1]?.replace(/"/g, '').trim() || '自訂',
                  address: cols[2]?.replace(/"/g, '').trim() || '',
                  lat: parseFloat(cols[3]) || null,
                  lng: parseFloat(cols[4]) || null,
                  note: cols[5]?.replace(/"/g, '').trim() || '',
                  visited: false,
                  distance: null
                });
                importedCount++;
              }
            }
          }

          savePlaces();
          updateAllDistances();
          alert(`匯入完成！已成功加入 ${importedCount} 筆新地點（已自動過濾重複項目）。`);
        } catch (err) {
          alert('解析檔案失敗，請確認檔案格式是否正確。');
        }
      };
      reader.readAsText(file);
    };

    // --- Gemini AI Assistant Query with Auto-Fallback ---
    const askQuick = (promptText) => {
      userInput.value = promptText;
      sendAiQuery();
    };

    const callGeminiApi = async (modelName, apiVersion, key, bodyData) => {
      const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      return res;
    };

    const sendAiQuery = async () => {
      const q = userInput.value.trim();
      if (!q) return;

      if (!apiKey.value) {
        alert('請先至「設定」輸入您的 Gemini API Key！');
        currentTab.value = 'settings';
        return;
      }

      aiLoading.value = true;
      aiResponse.value = '';
      recommendedPlaces.value = [];

      try {
        // Prepare context data: only send relevant list items with distance
        const placesContext = places.value.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          note: p.note,
          visited: p.visited ? '已訪' : '未訪',
          distance: p.distance !== null ? `${formatDistance(p.distance)}` : '距離未知'
        }));

        let systemPrompt = '';
        if (allowExternal.value) {
          systemPrompt = `你是一個個人美食與旅遊地圖專屬智慧助理。
以下是使用者手機儲存的私人地點清單資料（JSON）：
${JSON.stringify(placesContext)}

使用者的 GPS 目前位置狀態：${userLocation.value ? `緯度 ${userLocation.value.lat}, 經度 ${userLocation.value.lng}` : '未取得精準 GPS，以預估距離比對'}。

【模式設定：允許推薦外部名店】
請遵循以下規則：
1. 優先比對使用者的【私人清單】。若清單內有符合條件的店家，優先推薦並標註為「🌟 您的清單收藏」。
2. 若清單內數量不足或沒有相符項目（例如使用者尋找魯肉飯，但清單內只有拉麵），請充分發揮你的美食與景點知識庫，主動推薦使用者周邊 1~3 家最道地、Google 評分極高的【外部推薦名店】（標註為「🌐 探索新名店」），並附上推薦特色。
3. 若推薦清單內的店家，請在獨立行輸出：[RECOMMENDED_IDS: "id1", "id2"]。
4. 繁體中文回答，語氣熱情、生動、精練。`;
        } else {
          systemPrompt = `你是一個個人美食與旅遊地圖專屬助理。
以下是使用者手機儲存的私人地點清單資料（JSON）：
${JSON.stringify(placesContext)}

使用者的 GPS 目前位置狀態：${userLocation.value ? `緯度 ${userLocation.value.lat}, 經度 ${userLocation.value.lng}` : '未取得精準 GPS，以預估距離比對'}。

【模式設定：嚴格僅限私人清單】
請遵循以下規則：
1. 嚴格「只」能根據上述使用者的私人清單回答！如果私人清單內沒有符合的店家，請如實告知「您的清單內目前尚未收藏此類地點」，不可推薦清單外的外部店家。
2. 若有符合項目，推薦最適合的 1~3 家，並說明距離與推薦原因。
3. 若推薦清單內的店家，請在獨立行輸出：[RECOMMENDED_IDS: "id1", "id2"]。
4. 繁體中文回答，語氣簡潔精練。`;
        }

        const requestBody = {
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n使用者指令：${q}` }]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 800
          }
        };

        // Try candidate models in order: gemini-2.5-flash (confirmed supported!), gemini-2.5-pro, gemini-2.0-flash
        const candidateModels = [
          { model: 'gemini-2.5-flash', ver: 'v1beta' },
          { model: 'gemini-2.5-pro', ver: 'v1beta' },
          { model: 'gemini-2.0-flash', ver: 'v1beta' },
          { model: 'gemini-1.5-flash', ver: 'v1beta' }
        ];

        let lastError = null;
        let successData = null;
        let successfulModel = '';

        for (const cand of candidateModels) {
          try {
            const resp = await callGeminiApi(cand.model, cand.ver, apiKey.value.trim(), requestBody);
            if (resp.ok) {
              successData = await resp.json();
              successfulModel = cand.model;
              break;
            } else {
              const errJson = await resp.json();
              lastError = `[${cand.model}] ` + (errJson.error?.message || `HTTP ${resp.status}`);
            }
          } catch (e) {
            lastError = `[${cand.model}] ` + e.message;
          }
        }

        // If all standard models failed, query available models for this specific API key
        if (!successData) {
          try {
            const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.value.trim()}`);
            if (listResp.ok) {
              const listData = await listResp.json();
              const availableNames = (listData.models || [])
                .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
                .map(m => m.name.replace('models/', ''));

              if (availableNames.length > 0) {
                // Try the first available model that supports generateContent
                const dynamicModel = availableNames[0];
                const dynamicResp = await callGeminiApi(dynamicModel, 'v1beta', apiKey.value.trim(), requestBody);
                if (dynamicResp.ok) {
                  successData = await dynamicResp.json();
                  successfulModel = dynamicModel;
                }
              }
            }
          } catch (listErr) {
            console.warn('ListModels fallback failed:', listErr);
          }
        }

        if (!successData) {
          throw new Error(lastError || '所有模型端點皆無法連線，請確認 Google AI Studio 產生的 API Key 是否有效。');
        }

        const text = successData.candidates?.[0]?.content?.parts?.[0]?.text || '抱歉，暫無合適的推薦。';

        // Parse recommended IDs if any
        const match = text.match(/\[RECOMMENDED_IDS:\s*([^\]]+)\]/);
        if (match) {
          const idStrings = match[1].replace(/["']/g, '').split(',').map((s) => s.trim());
          recommendedPlaces.value = places.value.filter((p) => idStrings.includes(p.id));
          aiResponse.value = text.replace(/\[RECOMMENDED_IDS:[^\]]+\]/, '').trim();
        } else {
          aiResponse.value = text;
        }
      } catch (err) {
        aiResponse.value = `查詢失敗：${err.message}。請確認 API Key 是否有效。`;
      } finally {
        aiLoading.value = false;
        nextTick(() => {
          if (window.lucide) lucide.createIcons();
        });
      }
    };

    // --- Demo Data Initializer ---
    const loadSampleData = () => {
      places.value = [
        {
          id: 'p_1',
          name: '隱家拉麵 赤峰店',
          category: '拉麵',
          address: '台北市大同區南京西路25巷28號',
          lat: 25.0538,
          lng: 121.5204,
          note: '招牌真鯛魚白湯，肉量澎湃，平日排隊約 30 分鐘',
          visited: false
        },
        {
          id: 'p_2',
          name: '柑橘Shinn - Soba',
          category: '拉麵',
          address: '台北市大安區仁愛路四段228-6號',
          lat: 25.0378,
          lng: 121.5524,
          note: '柑橘蛤蜊湯頭超清爽，夏天必吃',
          visited: true
        },
        {
          id: 'p_3',
          name: '榕錦時光生活園區',
          category: '旅遊景點',
          address: '台北市大安區金華街157號',
          lat: 25.0298,
          lng: 121.5283,
          note: '原台北刑務所官舍日式老宅，散步喝咖啡很棒',
          visited: false
        },
        {
          id: 'p_4',
          name: 'Simple Kaffa 興波咖啡 旗艦店',
          category: '咖啡',
          address: '台北市中正區忠孝東路二段27號',
          lat: 25.0445,
          lng: 121.5298,
          note: '世界冠軍咖啡，地瓜三明治與手沖藝妓',
          visited: false
        },
        {
          id: 'p_5',
          name: '勝王拉麵',
          category: '拉麵',
          address: '台北市中山區林森北路306號',
          lat: 25.0568,
          lng: 121.5262,
          note: '每日限定特製湯頭，拉麵控必吃聖地',
          visited: false
        },
        {
          id: 'p_6',
          name: '象山步道六巨石',
          category: '旅遊景點',
          address: '台北市信義區信義路五段150巷',
          lat: 25.0272,
          lng: 121.5762,
          note: '傍晚看 101 夕陽與夜景絕佳位置',
          visited: false
        }
      ];
      savePlaces();
      updateAllDistances();
    };

    const exportData = () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(places.value, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `MapAI_Backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    };

    const confirmClear = () => {
      if (confirm('確定要清空所有地點嗎？此動作無法復原！')) {
        places.value = [];
        savePlaces();
      }
    };

    // --- Force Update & Clear Cache ---
    const forceUpdateApp = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (let reg of regs) {
            await reg.unregister();
          }
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          for (let key of keys) {
            await caches.delete(key);
          }
        }
      } catch (e) {
        console.warn('Cache clear warning:', e);
      }
      // Force reload with timestamp query to bypass iOS browser cache
      window.location.href = window.location.pathname + '?reload=' + Date.now();
    };

    // --- Share Target API Handling (when shared from mobile) ---
    const checkShareTargetParams = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sharedUrl = urlParams.get('url') || urlParams.get('text');
      if (sharedUrl) {
        currentTab.value = 'add';
        newPlaceUrl.value = sharedUrl;
        setTimeout(() => {
          parseAndAddUrl();
        }, 500);
      }
    };

    // --- Lifecycle Mounted ---
    onMounted(() => {
      loadSavedData();
      refreshLocation();
      checkShareTargetParams();

      // Register PWA Service Worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
          console.log('SW registration optional warning:', err);
        });
      }

      nextTick(() => {
        if (window.lucide) lucide.createIcons();
      });
    });

    return {
      currentTab,
      places,
      apiKey,
      userLocation,
      locating,
      showTutorial,
      userInput,
      aiResponse,
      aiLoading,
      allowExternal,
      recommendedPlaces,
      quickPrompts,
      searchQuery,
      selectedCategory,
      categories,
      filteredPlaces,
      sortedPlaces,
      newPlaceUrl,
      parsingUrl,
      manualForm,
      formatDistance,
      refreshLocation,
      askQuick,
      sendAiQuery,
      readFromClipboard,
      parseAndAddUrl,
      addManualPlace,
      toggleVisited,
      deletePlace,
      getNavigationUrl,
      handleFileUpload,
      saveApiKey,
      testApiKey,
      testingKey,
      keyTestResult,
      keyTestSuccess,
      loadSampleData,
      exportData,
      confirmClear,
      forceUpdateApp
    };
  }
}).mount('#app');
