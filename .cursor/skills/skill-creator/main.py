def execute(input_data):
    """
    执行技能的主要逻辑
    
    Args:
        input_data (dict): 输入数据
        
    Returns:
        dict: 输出结果
    """
    result = {
        "status": "success",
        "message": "技能执行成功",
        "data": input_data
    }
    
    return result

if __name__ == "__main__":
    test_input = {
        "test": "data"
    }
    output = execute(test_input)
    print(output)