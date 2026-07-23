import { settingsApi } from "../../api/SettingsApi";

const useSettings = () => {

    const getAll = async (params) => {
        const { data } = await settingsApi.getAll(params);
        return data;
    }

    const update = async (data) => {
        const { data: responseData } = await settingsApi.update(data);
        return responseData;
    }

    return {
		getAll,
        update
    }
}

export default useSettings;