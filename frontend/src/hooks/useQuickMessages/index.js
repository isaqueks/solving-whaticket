import { quickMessagesApi } from "../../api/QuickMessagesApi";

const useQuickMessages = () => {

    const save = async (data) => {
        const { data: responseData } = await quickMessagesApi.save(data);
        return responseData;
    }

    const update = async (data) => {
        const { data: responseData } = await quickMessagesApi.update(data);
        return responseData;
    }

    const deleteRecord = async (id) => {
        const { data } = await quickMessagesApi.remove(id);
        return data;
    }

    const list = async (params) => {
        const { data } = await quickMessagesApi.list(params);
        return data;
    }

    return {
        save,
        update,
        deleteRecord,
        list
    }
}

export default useQuickMessages;