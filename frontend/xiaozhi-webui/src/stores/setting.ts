import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useSettingStore = defineStore('setting', () => {
  const wsURL = ref<string>("wss://api.tenclass.net/xiaozhi/v1/")
  const wsProxyURL = ref<string>("ws://localhost:5000")
  const tokenEnable = ref<boolean>(false)
  const token = ref<string>("")
  const sessionID = ref<string>("")
  const deviceID = ref<string>("")
  const visible = ref<boolean>(false)

  const fetchConfig = async () => {
    try {
      const response = await fetch(import.meta.env.VITE_APP_SERVER_URL + "/config")
      const data = (await response.json()).data
      console.log("[useSettingStore][fetchConfig] data: ", data)
      if (data.ws_proxy_url) {
        wsProxyURL.value = data.ws_proxy_url
      }
      if (data.ws_url) {
        wsURL.value = data.ws_url
      }
      if (data.token_enable) {
        tokenEnable.value = data.token_enable
        token.value = data.token
      }
      if (data.device_id) {
        deviceID.value = data.device_id
        console.log("[useSettingStore][fetchConfig] device_id: ", data.device_id)
      }
    } catch (error) {
      console.error("[useSettingStore][fetchConfig]", error)
    }
  }

  const saveToLocal = () => {
    const setting = {
      ws_url: wsURL.value,
      ws_proxy_url: wsProxyURL.value,
      token_enable: tokenEnable.value,
      token: token.value,
    }
    localStorage.setItem('settings', JSON.stringify(setting))
    console.log("[useSettingStore][saveToLocal] 配置文件更新成功")
  }

  const updateSettings = (settings: any) => {
    wsURL.value = settings.ws_url
    wsProxyURL.value = settings.ws_proxy_url
    tokenEnable.value = settings.token_enable
    token.value = settings.token
  }

  const loadFromLocal = () => {
    const localSetting = localStorage.getItem('settings')
    if (localSetting) {
      updateSettings(JSON.parse(localSetting))
      console.log("[useSettingStore][loadFromLocal] 配置文件加载成功")
    } else {
      console.log("[useSettingStore][loadFromLocal] 配置文件不存在")
    }
  }

  return {
    wsURL,
    wsProxyURL,
    tokenEnable,
    sessionID,
    deviceID,
    token,
    visible,
    updateSettings,
    fetchConfig,
    saveToLocal,
    loadFromLocal,
  }
})
