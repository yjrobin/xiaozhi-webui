import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useSettingStore = defineStore('setting', () => {
  const sessionID = ref<string>("")
  const deviceID = ref<string>("")
  const wsURL = ref<string>("wss://api.tenclass.net/xiaozhi/v1/")
  const wsProxyURL = ref<string>("ws://localhost:5000")
  const otaVersionURL = ref<string>("")
  const tokenEnable = ref<boolean>(false)
  const token = ref<string>("")
  const visible = ref<boolean>(false)

  const fetchConfig = async () => {
    try {
      const response = await fetch(import.meta.env.VITE_APP_SERVER_URL + "/config")
      const data = (await response.json()).data
      console.log("[useSettingStore][fetchConfig] data: ", data)

      type ConfigData = {
        ws_url?: string
        ws_proxy_url?: string
        ota_version_url?: string,
        token_enable?: boolean
        token?: string
        device_id?: string
        [key: string]: string | boolean | undefined
      }

      const configMap = {
        ws_url: wsURL,
        ws_proxy_url: wsProxyURL,
        ota_version_url: otaVersionURL,
        token_enable: tokenEnable,
        token: token,
        device_id: deviceID
      }

      Object.entries(configMap).forEach(([key, ref]) => {
        const value = (data as ConfigData)[key]
        if (value !== undefined && value !== null) {
          if (key === 'device_id') {
            console.log("[useSettingStore][fetchConfig] device_id: ", value)
          }
          if (key === 'ws_proxy_url' && typeof value === 'string') {
            ref.value = 'ws://localhost' + value.substring(value.lastIndexOf(':'))
          } else {
            ref.value = value
          }
        }
      })
    } catch (error) {
      console.error("[useSettingStore][fetchConfig]", error)
    }
  }

  const saveToLocal = () => {
    const setting = {
      ws_url: wsURL.value,
      ws_proxy_url: wsProxyURL.value,
      ota_version_url: otaVersionURL.value,
      token_enable: tokenEnable.value,
      token: token.value,
    }
    console.log("[useSettingStore][saveToLocal] setting: ", setting)
    localStorage.setItem('settings', JSON.stringify(setting))
    console.log("[useSettingStore][saveToLocal] 配置文件更新成功")
  }

  const updateSettings = (settings: any) => {
    const configMap = {
      ws_url: wsURL,
      ws_proxy_url: wsProxyURL,
      ota_version_url: otaVersionURL,
      token_enable: tokenEnable,
      token: token,
    }

    Object.entries(configMap).forEach(([key, ref]) => {
      if (settings[key] !== undefined && settings[key] !== null) {
        ref.value = settings[key]
      }
    })
  }

  const loadFromLocal = (): boolean => {
    const localSetting = localStorage.getItem('settings')
    if (localSetting) {
      updateSettings(JSON.parse(localSetting))
      console.log("[useSettingStore][loadFromLocal] 配置文件加载成功")
      return true
    }
    console.log("[useSettingStore][loadFromLocal] 配置文件不存在")
    return false
  }

  return {
    wsURL,
    wsProxyURL,
    otaVersionURL,
    tokenEnable,
    token,
    sessionID,
    deviceID,
    visible,
    updateSettings,
    fetchConfig,
    saveToLocal,
    loadFromLocal,
  }
})
