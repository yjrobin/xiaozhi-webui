import { ref, type Ref } from 'vue'
import { defineStore } from 'pinia'

type ConfigData = {
	[key: string]: string | boolean,
	ws_url: string
	ws_proxy_url: string
	ota_version_url: string,
	backend_url: string,
	token_enable: boolean
	token: string
	device_id: string
}

export const useSettingStore = defineStore('setting', () => {
	// state
	const sessionId = ref<string>("")
	const deviceId = ref<string>("")
	const wsUrl = ref<string>("")
	const wsProxyUrl = ref<string>("")
	const otaVersionUrl = ref<string>("")
	const backendUrl = ref<string>("")
	const tokenEnable = ref<boolean>(false)
	const token = ref<string>("")
	const visible = ref<boolean>(false)
	
	const configRefMap: Record<string, Ref<string | boolean>> = {
		ws_url: wsUrl,
		ws_proxy_url: wsProxyUrl,
		ota_version_url: otaVersionUrl,
		token_enable: tokenEnable,
		token: token,
		device_id: deviceId
	}

	const fetchConfig = async () => {
		try {
			const response = await fetch(backendUrl.value + "/config")
			const jsonData = await response.json()
			console.log("[useSettingStore][fetchConfig] response: ", jsonData)
			if (!response.ok) {
				throw new Error("Failed to fetch config")
			}
			const { data } = jsonData as { data: ConfigData }
			Object.entries(configRefMap).forEach(([key, ref]) => {
				const value = data[key]
				if (value !== undefined && value !== null) {
					// 本地服务器和本地代理 IP 默认为 localhost
					if (key === 'ws_proxy_url' && typeof value === 'string') {
						const backendIp = backendUrl.value.split('://')[1].split(':')[0]
						ref.value = `ws://${backendIp}` + value.substring(value.lastIndexOf(':'))
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
		const configJson = {
			ws_url: wsUrl.value,
			ws_proxy_url: wsProxyUrl.value,
			ota_version_url: otaVersionUrl.value,
			backend_url: backendUrl.value,
			token_enable: tokenEnable.value,
			token: token.value,
			device_id: deviceId.value
		}
		localStorage.setItem('settings', JSON.stringify(configJson))
		console.log("[useSettingStore][saveToLocal] 配置文件更新成功", configJson)
	}

	const updateConfig = (settings: any) => {
		Object.entries(configRefMap).forEach(([key, ref]) => {
			if (settings[key] !== undefined && settings[key] !== null) {
				ref.value = settings[key]
			}
		})
	}

	const loadFromLocal = (): boolean => {
		const localConfig = localStorage.getItem('settings')
		if (localConfig) {
			updateConfig(JSON.parse(localConfig))
			console.log("[useSettingStore][loadFromLocal] 配置文件加载成功")
			return true
		}
		console.log("[useSettingStore][loadFromLocal] 配置文件不存在")
		return false
	}

	return {
		sessionId,
		deviceId,
		wsUrl,
		wsProxyUrl,
		otaVersionUrl,
		backendUrl,
		tokenEnable,
		token,
		visible,
		updateConfig,
		fetchConfig,
		saveToLocal,
		loadFromLocal,
	}
})

