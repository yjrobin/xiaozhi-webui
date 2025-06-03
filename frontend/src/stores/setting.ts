import { ref, type Ref, computed } from 'vue'
import { defineStore } from 'pinia'

type ConfigData = {
	[key: string]: string | boolean,
	ws_url: string
	ws_proxy_url: string
	ota_version_url: string,
	token_enable: boolean
	token: string
	device_id: string
}

export const useSettingStore = defineStore('setting', () => {
	// state
	const _sessionId = ref<string>("")
	const _deviceId = ref<string>("")
	const _wsUrl = ref<string>("")
	const _wsProxyUrl = ref<string>("")
	const _otaVersionUrl = ref<string>("")
	const _tokenEnable = ref<boolean>(false)
	const _token = ref<string>("")
	const _visible = ref<boolean>(false)

	// getter
	const sessionId = computed(() => _sessionId.value)
	const deviceId = computed(() => _deviceId.value)
	const wsUrl = computed(() => _wsUrl.value)
	const wsProxyUrl = computed(() => _wsProxyUrl.value)
	const otaVersionUrl = computed(() => _otaVersionUrl.value)
	const tokenEnable = computed(() => _tokenEnable.value)
	const token = computed(() => _token.value)
	const visible = computed(() => _visible.value)

	// mutation action
	const setSessionId = (id: string) => {
		_sessionId.value = id
	}

	const setDeviceId = (id: string) => {
		_deviceId.value = id
	}

	const setWsUrl = (url: string) => {
		_wsUrl.value = url
	}

	const setWsProxyUrl = (url: string) => {
		_wsProxyUrl.value = url
	}

	const setOtaVersionUrl = (url: string) => {
		_otaVersionUrl.value = url
	}

	const setTokenEnable = (enable: boolean) => {
		_tokenEnable.value = enable
	}

	const setToken = (newToken: string) => {
		_token.value = newToken
	}

	const setVisible = (v: boolean) => {
		_visible.value = v
	}

	const configRefMap: Record<string, Ref<string | boolean>> = {
		ws_url: _wsUrl,
		ws_proxy_url: _wsProxyUrl,
		ota_version_url: _otaVersionUrl,
		token_enable: _tokenEnable,
		token: _token,
		device_id: _deviceId
	}

	// service action
	const fetchConfig = async () => {
		try {
			const response = await fetch(import.meta.env.VITE_APP_SERVER_URL + "/config")
			const jsonData = await response.json()
			console.log("[useSettingStore][fetchConfig] response: ", jsonData)
			if (!response.ok) {
				throw new Error("Failed to fetch config")
			}
			const { data } = jsonData as { data: ConfigData }
			Object.entries(configRefMap).forEach(([key, ref]) => {
				const value = data[key]
				if (value !== undefined && value !== null) {
					if (key === 'device_id') {
						console.log("[useSettingStore][fetchConfig] device_id: ", value)
					}
					if (key === 'ws_proxy_url' && typeof value === 'string') {
						ref.value = 'ws://localhost' + value.substring(value.lastIndexOf(':'))  // 获取代理 Websocket 的运行端口号
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
			ws_url: _wsUrl.value,
			ws_proxy_url: _wsProxyUrl.value,
			ota_version_url: _otaVersionUrl.value,
			token_enable: _tokenEnable.value,
			token: _token.value,
			device_id: _deviceId.value
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
		tokenEnable,
		token,
		visible,
		setSessionId,
		setDeviceId,
		setWsUrl,
		setWsProxyUrl,
		setOtaVersionUrl,
		setTokenEnable,
		setToken,
		setVisible,
		updateConfig,
		fetchConfig,
		saveToLocal,
		loadFromLocal,
	}
})
