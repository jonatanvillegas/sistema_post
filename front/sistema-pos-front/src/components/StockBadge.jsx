import React from 'react';
import { Tag } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const StockBadge = ({ stock = 0, stockMinimo = 5, controlaStock = true }) => {
  if (controlaStock === false) {
    return (
      <Tag color="default" bordered={false}>
        No controla stock
      </Tag>
    );
  }

  if (stock <= 0) {
    return (
      <Tag icon={<CloseCircleOutlined />} color="error" bordered={false}>
        Sin Stock
      </Tag>
    );
  }

  if (stock <= stockMinimo) {
    return (
      <Tag icon={<ExclamationCircleOutlined />} color="warning" bordered={false}>
        Stock Bajo ({stock})
      </Tag>
    );
  }

  return (
    <Tag icon={<CheckCircleOutlined />} color="success" bordered={false}>
      Existencia ({stock})
    </Tag>
  );
};

export default StockBadge;
