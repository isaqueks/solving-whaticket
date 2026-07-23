import { companiesApi } from "../../api/CompaniesApi";

const useCompanies = () => {

    const save = async (data) => {
        const { data: responseData } = await companiesApi.save(data);
        return responseData;
    }

    const findAll = async (id) => {
        const { data } = await companiesApi.findAll();
        return data;
    }

    const list = async (id) => {
        const { data } = await companiesApi.list();
        return data;
    }

    const find = async (id) => {
        const { data } = await companiesApi.find(id);
        return data;
    }

    const finding = async (id) => {
        const { data } = await companiesApi.find(id);
        return data;
    }


    const update = async (data) => {
        const { data: responseData } = await companiesApi.update(data);
        return responseData;
    }

    const remove = async (id) => {
        const { data } = await companiesApi.remove(id);
        return data;
    }

    const updateSchedules = async (data) => {
        const { data: responseData } = await companiesApi.updateSchedules(data);
        return responseData;
    }

    return {
        save,
        update,
        remove,
        list,
        find,
        finding,
        findAll,
        updateSchedules
    }
}

export default useCompanies;