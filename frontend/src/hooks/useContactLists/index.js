import { contactListsApi } from "../../api/ContactListsApi";

const useContactLists = () => {
  const save = async (data) => {
    const { data: responseData } = await contactListsApi.save(data);
    return responseData;
  };

  const update = async (data) => {
    const { data: responseData } = await contactListsApi.update(data);
    return responseData;
  };

  const deleteRecord = async (id) => {
    const { data } = await contactListsApi.remove(id);
    return data;
  };

  const findById = async (id) => {
    const { data } = await contactListsApi.findById(id);
    return data;
  };

  const list = async (params) => {
    const { data } = await contactListsApi.list(params);
    return data;
  };

  return {
    findById,
    save,
    update,
    deleteRecord,
    list,
  };
};

export default useContactLists;