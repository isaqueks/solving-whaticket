import { versionApi } from "../../api/VersionApi";

const useVersion = () => {

    const getVersion = async () => {
        const { data } = await versionApi.getVersion();
        return data;
    }

    return {
        getVersion
    }
}

export default useVersion;