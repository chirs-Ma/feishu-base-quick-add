document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const appIdInput = document.getElementById('app-id');
  const appSecretInput = document.getElementById('app-secret');
  const sheetTokenInput = document.getElementById('sheet-token');
  const sheetIdInput = document.getElementById('sheet-id');
  const configNameInput = document.getElementById('config-name');
  const configSelect = document.getElementById('config-select');
  const fieldsContainer = document.getElementById('fields-container');
  const fieldInputs = document.getElementById('field-inputs');
  const saveConfigBtn = document.getElementById('save-config');
  const deleteConfigBtn = document.getElementById('delete-config');
  const addDataBtn = document.getElementById('add-data');
  const statusDiv = document.getElementById('status');
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // 标签页切换功能
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      // 移除所有标签页的active类
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // 添加当前标签页的active类
      this.classList.add('active');
      const tabId = this.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });

  // 加载所有保存的配置
  loadConfigurations();

  // 添加字段按钮点击事件
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('add-field')) {
      addFieldRow();
    } else if (e.target.classList.contains('remove-field')) {
      e.target.parentElement.remove();
    }
  });

  // 配置选择变化事件
  configSelect.addEventListener('change', function() {
    const configId = this.value;
    if (configId) {
      loadConfigurationDetails(configId);
    } else {
      // 清空字段输入区域
      fieldInputs.innerHTML = '<div class="field-placeholder">请先选择一个表格配置</div>';
    }
  });

  // 保存配置按钮点击事件
  saveConfigBtn.addEventListener('click', function() {
    const configName = configNameInput.value.trim();
    const appId = appIdInput.value.trim();
    const appSecret = appSecretInput.value.trim();
    const sheetToken = sheetTokenInput.value.trim();
    const sheetId = sheetIdInput.value.trim();

    if (!configName || !appId || !appSecret || !sheetToken || !sheetId) {
      showStatus('请填写所有必填字段', 'error');
      return;
    }

    // 获取所有字段名称
    const fieldNames = [];
    const fieldInputElements = fieldsContainer.querySelectorAll('.field-name');
    fieldInputElements.forEach(input => {
      const fieldName = input.value.trim();
      if (fieldName) {
        fieldNames.push(fieldName);
      }
    });

    if (fieldNames.length === 0) {
      showStatus('请至少添加一个字段', 'error');
      return;
    }

    // 检查是否是编辑现有配置
    const selectedConfigId = configSelect.value;
    let configId;
    
    if (selectedConfigId) {
      // 编辑现有配置
      configId = selectedConfigId;
    } else {
      // 创建新配置
      configId = Date.now().toString();
    }
    
    const config = {
      id: configId,
      name: configName,
      appId: appId,
      appSecret: appSecret,
      sheetToken: sheetToken,
      sheetId: sheetId,
      fields: fieldNames
    };

    // 保存配置
    saveConfiguration(config);
    showStatus(selectedConfigId ? '配置已更新' : '配置已保存', 'success');
    // 注意：表单清空逻辑已移至saveConfiguration函数中
  });

  // 删除配置按钮点击事件
  deleteConfigBtn.addEventListener('click', function() {
    const configId = configSelect.value;
    if (!configId) {
      showStatus('请先选择一个配置', 'error');
      return;
    }

    // 确认删除
    if (confirm('确定要删除此配置吗？')) {
      deleteConfiguration(configId);
      showStatus('配置已删除', 'success');
    }
  });

  // 添加数据按钮点击事件
  addDataBtn.addEventListener('click', function() {
    const configId = configSelect.value;
    if (!configId) {
      showStatus('请先选择一个表格配置', 'error');
      return;
    }

    // 获取当前配置
    chrome.storage.sync.get(['configurations'], function(result) {
      const configurations = result.configurations || [];
      const config = configurations.find(c => c.id === configId);
      
      if (!config) {
        showStatus('配置不存在', 'error');
        return;
      }

      // 收集字段数据
      const data = {};
      const fieldInputElements = fieldInputs.querySelectorAll('.field-input');
      let isValid = true;

      fieldInputElements.forEach(input => {
        const fieldName = input.getAttribute('data-field');
        const fieldValue = input.value.trim();
        
        if (!fieldValue) {
          showStatus(`请填写字段: ${fieldName}`, 'error');
          isValid = false;
          return;
        }
        
        data[fieldName] = fieldValue;
      });

      if (!isValid) return;

      // 生成一个随机的clientToken
      const clientToken = 'fe' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // 发送消息给后台脚本处理API请求
      chrome.runtime.sendMessage({
        action: 'addData',
        appId: config.appId,
        appSecret: config.appSecret,
        sheetToken: config.sheetToken,
        sheetId: config.sheetId,
        clientToken: clientToken,
        data: data
      }, function(response) {
        if (response.success) {
          showStatus('数据添加成功', 'success');
          // 清空所有字段输入
          fieldInputElements.forEach(input => {
            input.value = '';
          });
        } else {
          showStatus('数据添加失败: ' + response.error, 'error');
        }
      });
    });
  });

  // 添加字段行
  function addFieldRow() {
    const fieldRow = document.createElement('div');
    fieldRow.className = 'field-row';
    fieldRow.innerHTML = `
      <input type="text" class="field-name" placeholder="字段名称">
      <button class="remove-field">-</button>
    `;
    
    // 在添加按钮行之前插入新行
    const addButtonRow = fieldsContainer.querySelector('.field-row:last-child');
    fieldsContainer.insertBefore(fieldRow, addButtonRow);
  }

  // 加载所有配置
  function loadConfigurations() {
    chrome.storage.sync.get(['configurations'], function(result) {
      const configurations = result.configurations || [];
      
      // 清空下拉列表
      configSelect.innerHTML = '<option value="">-- 请选择配置 --</option>';
      
      // 添加配置选项
      configurations.forEach(config => {
        const option = document.createElement('option');
        option.value = config.id;
        option.textContent = config.name;
        configSelect.appendChild(option);
      });

      // 更新配置列表显示
      const savedConfigsDiv = document.getElementById('saved-configs');
      savedConfigsDiv.innerHTML = '';
      
      if (configurations.length === 0) {
        savedConfigsDiv.innerHTML = '<p>暂无保存的配置</p>';
      } else {
        configurations.forEach(config => {
          const configItem = document.createElement('div');
          configItem.className = 'config-item';
          configItem.innerHTML = `
            <div class="config-item-header">
              <span class="config-item-name">${config.name}</span>
              <div class="config-item-actions">
                <button class="edit-config" data-id="${config.id}">编辑</button>
                <button class="delete-config" data-id="${config.id}">删除</button>
              </div>
            </div>
            <div class="config-item-details">
              <p>表格ID: ${config.sheetId}</p>
              <p>字段数: ${config.fields.length}</p>
            </div>
          `;
          savedConfigsDiv.appendChild(configItem);
        });
        
        // 为编辑和删除按钮添加事件监听
        const editButtons = savedConfigsDiv.querySelectorAll('.edit-config');
        const deleteButtons = savedConfigsDiv.querySelectorAll('.delete-config');
        
        editButtons.forEach(button => {
          button.addEventListener('click', function() {
            const configId = this.getAttribute('data-id');
            configSelect.value = configId;
            loadConfigurationDetails(configId);
          });
        });
        
        deleteButtons.forEach(button => {
          button.addEventListener('click', function() {
            const configId = this.getAttribute('data-id');
            if (confirm('确定要删除此配置吗？')) {
              deleteConfiguration(configId);
              showStatus('配置已删除', 'success');
            }
          });
        });
      }
    });
  }

  // 加载配置详细信息
  function loadConfigurationDetails(configId) {
    chrome.storage.sync.get(['configurations'], function(result) {
      const configurations = result.configurations || [];
      const config = configurations.find(c => c.id === configId);
      
      if (config) {
        // 填充配置表单（用于编辑）
        configNameInput.value = config.name;
        appIdInput.value = config.appId;
        appSecretInput.value = config.appSecret;
        sheetTokenInput.value = config.sheetToken;
        sheetIdInput.value = config.sheetId;
        
        // 清空并重建字段行
        fieldsContainer.innerHTML = '';
        config.fields.forEach(field => {
          const fieldRow = document.createElement('div');
          fieldRow.className = 'field-row';
          fieldRow.innerHTML = `
            <input type="text" class="field-name" placeholder="字段名称" value="${field}">
            <button class="remove-field">-</button>
          `;
          fieldsContainer.appendChild(fieldRow);
        });
        
        // 添加一个新的添加按钮行
        const addButtonRow = document.createElement('div');
        addButtonRow.className = 'field-row';
        addButtonRow.innerHTML = `
          <input type="text" class="field-name" placeholder="字段名称">
          <button class="add-field">+</button>
        `;
        fieldsContainer.appendChild(addButtonRow);
        
        // 生成快速添加表单的字段输入框
        generateFieldInputs(config.fields);
      }
    });
  }

  // 生成字段输入框
  function generateFieldInputs(fields) {
    fieldInputs.innerHTML = '';
    
    fields.forEach(field => {
      const fieldDiv = document.createElement('div');
      fieldDiv.className = 'field';
      fieldDiv.innerHTML = `
        <label for="field-${field}">${field}</label>
        <input type="text" id="field-${field}" class="field-input" data-field="${field}" placeholder="输入${field}">
      `;
      fieldInputs.appendChild(fieldDiv);
    });
  }

  // 保存配置
  function saveConfiguration(config) {
    chrome.storage.sync.get(['configurations'], function(result) {
      let configurations = result.configurations || [];
      
      // 检查是否已存在相同ID的配置
      const existingIndex = configurations.findIndex(c => c.id === config.id);
      if (existingIndex !== -1) {
        // 更新现有配置
        configurations[existingIndex] = config;
      } else {
        // 添加新配置
        configurations.push(config);
      }
      
      // 保存到存储
      chrome.storage.sync.set({ configurations: configurations }, function() {
        // 重新加载配置列表
        loadConfigurations();
        
        // 清空表单数据
        configNameInput.value = '';
        appIdInput.value = '';
        appSecretInput.value = '';
        sheetTokenInput.value = '';
        sheetIdInput.value = '';
        configSelect.value = '';
        
        // 重置字段容器为初始状态
        fieldsContainer.innerHTML = `
          <div class="field-row">
            <input type="text" class="field-name" placeholder="字段名称">
            <button class="add-field">+</button>
          </div>
        `;
        
        // 清空字段输入区域
        fieldInputs.innerHTML = '<div class="field-placeholder">请先选择一个表格配置</div>';
      });
    });
  }

  // 删除配置
  function deleteConfiguration(configId) {
    chrome.storage.sync.get(['configurations'], function(result) {
      let configurations = result.configurations || [];
      
      // 过滤掉要删除的配置
      configurations = configurations.filter(c => c.id !== configId);
      
      // 保存到存储
      chrome.storage.sync.set({ configurations: configurations }, function() {
        // 重新加载配置列表
        loadConfigurations();
        
        // 清空配置表单
        configNameInput.value = '';
        appIdInput.value = '';
        appSecretInput.value = '';
        sheetTokenInput.value = '';
        sheetIdInput.value = '';
        fieldsContainer.innerHTML = `
          <div class="field-row">
            <input type="text" class="field-name" placeholder="字段名称">
            <button class="add-field">+</button>
          </div>
        `;
        
        // 清空字段输入区域
        fieldInputs.innerHTML = '<div class="field-placeholder">请先选择一个表格配置</div>';
      });
    });
  }

  // 显示状态信息
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status';
    statusDiv.classList.add(type);
    
    // 5秒后自动隐藏
    setTimeout(function() {
      statusDiv.className = 'status';
    }, 5000);
  }
});