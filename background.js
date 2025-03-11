
// 飞书API相关常量
const API_ENDPOINT = 'https://open.feishu.cn/open-apis';
const TENANT_ACCESS_TOKEN_URL = `${API_ENDPOINT}/auth/v3/tenant_access_token/internal`;
const BITABLE_RECORD_URL = `${API_ENDPOINT}/bitable/v1/apps/`;

// 监听来自popup的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'addData') {
    addDataToSheet(request, sendResponse);
    return true; // 保持消息通道开放，以便异步响应
  }
});

// 通用请求方法
async function feishuRequest({ method, path, params, data, appId, appSecret }) {
  const url = new URL(`${API_ENDPOINT}${path}`);
  
  // 添加查询参数
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  // 转换 Map 类型数据为普通对象
  const normalizeData = (obj) => {
    if (obj instanceof Map) {
      return Object.fromEntries(obj);
    }
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(k => {
        obj[k] = normalizeData(obj[k]);
      });
    }
    return obj;
  };

  // 获取租户访问令牌
  const tokenResponse = await fetch(TENANT_ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret
    })
  });

  const tokenData = await tokenResponse.json();
  if (tokenData.code !== 0) {
    throw new Error(`获取访问令牌失败: ${tokenData.msg}`);
  }

  const tenantToken = tokenData.tenant_access_token;

  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tenantToken}`
      },
      body: data ? JSON.stringify(normalizeData(data)) : null
    });

    const responseData = await response.json();
    if (responseData.code !== 0) {
      throw new Error(JSON.stringify(responseData, null, 4));
    }

    return responseData;
  } catch (error) {
    throw error;
  }
}

// 添加数据到飞书多维表格 - 使用fetch API
async function addDataToSheet(request, sendResponse) {
  try {
    // 准备要添加的数据
    const fields = new Map();
    
    // 将数据转换为飞书多维表格API需要的格式
    Object.entries(request.data).forEach(([key, value]) => {
      fields.set(key, {
        'text': value,
        'link': value
      });
    });
    
    // 调用飞书多维表格API添加数据
    try {
      
      const response = await feishuRequest({
        method: 'POST',
        path: `/bitable/v1/apps/${request.sheetToken}/tables/${request.sheetId}/records`,
        data: {
          fields: fields
        },
        appId: request.appId,
        appSecret: request.appSecret
      });
      
      // 检查响应
      if (response.code === 0 || !response.code) {
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: `API错误: ${response.code}, ${response.msg}` });
      }
    } catch (apiError) {
      // 尝试提取更详细的错误信息
      let errorMessage = apiError.message;
      
      if (apiError.response && apiError.response.data) {
        try {
          const errorData = apiError.response.data;
          errorMessage = `API错误: ${errorData.code}, ${errorData.msg}`;
        } catch (e) {
          // 无法解析API错误详情
        }
      }
      
      sendResponse({ success: false, error: errorMessage });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

