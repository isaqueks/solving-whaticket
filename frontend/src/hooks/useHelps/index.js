import { helpsApi } from "../../api/HelpsApi";

const usePlans = () => {

    const findAll = async (params) => {
        const { data } = await helpsApi.findAll(params);
        return data;
    }

    const list = async (params) => {
        const { data } = await helpsApi.list(params);
        return data;
    }

    const save = async (data) => {
        const { data: responseData } = await helpsApi.save(data);
        return responseData;
    }

    const update = async (data) => {
        const { data: responseData } = await helpsApi.update(data);
        return responseData;
    }

    const remove = async (id) => {
        const { data } = await helpsApi.remove(id);
        return data;
    }

    return {
        findAll,
        list,
        save,
        update,
        remove
    }
}

export default usePlans;