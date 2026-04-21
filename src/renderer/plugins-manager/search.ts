import { reactive, toRefs } from 'vue';

const searchManager = () => {
  const state = reactive({
    searchValue: '',
    placeholder: '',
    subInputActive: false,
  });

  // search Input operation
  const onSearch = (e) => {
    const value = e.target.value;
    state.searchValue = value;
  };

  const setSearchValue = (value: string) => {
    state.searchValue = value;
  };

  window.setSubInput = ({ placeholder }: { placeholder: string }) => {
    state.placeholder = placeholder;
    state.subInputActive = true;
  };
  window.removeSubInput = () => {
    state.placeholder = '';
    state.subInputActive = false;
  };
  window.setSubInputValue = ({ value }: { value: string }) => {
    state.searchValue = value;
    state.subInputActive = true;
  };

  window.getMainInputInfo = () => {
    return {
      value: state.searchValue,
      placeholder: state.placeholder,
      active: state.subInputActive,
    };
  };

  return {
    ...toRefs(state),
    onSearch,
    setSearchValue,
  };
};

export default searchManager;
